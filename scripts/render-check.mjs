/**
 * Browser-level render check. The HTTP smoke test only sees server HTML, and
 * tool widgets are client-only (ssr: false), so a widget that throws on mount
 * would slip through. This visits every tool route in a real browser and
 * asserts the workspace actually mounted.
 *
 *   node scripts/render-check.mjs http://localhost:3000
 *
 * Optional: skips with a message when Puppeteer is not installed.
 */
import { pathToFileURL } from "node:url";

const base = process.argv[2] ?? "http://localhost:3000";

async function loadPuppeteer() {
  try {
    return (await import("puppeteer")).default;
  } catch {
    // Fall back to a machine-wide install, which is how this repo is checked locally.
    const globalPath = `${process.env.APPDATA ?? ""}/npm/node_modules/puppeteer/lib/puppeteer/puppeteer.js`;
    try {
      return (await import(pathToFileURL(globalPath).href)).default;
    } catch {
      return null;
    }
  }
}

const puppeteer = await loadPuppeteer();
if (!puppeteer) {
  console.log("render-check skipped: Puppeteer is not installed (npm i -D puppeteer to enable).");
  process.exit(0);
}

const sitemap = await fetch(`${base}/sitemap.xml`).then((response) => response.text());
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => new URL(match[1]).pathname)
  .filter((path) => {
    const segments = path.split("/").filter(Boolean);
    return segments.length === 2 && segments[0].endsWith("-tools");
  });

const launchOptions = { args: ["--no-sandbox"] };
if (process.env.CHROME_PATH) launchOptions.executablePath = process.env.CHROME_PATH;
const browser = await puppeteer.launch(launchOptions);
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const failures = [];
for (const route of routes) {
  const consoleErrors = [];
  const onError = (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 120));
  };
  page.on("console", onError);
  try {
    await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[aria-label="Tool workspace"]', { timeout: 20000 });
    const broken = await page.evaluate(() =>
      /hit an unexpected error|Application error/i.test(document.body.innerText),
    );
    if (broken) failures.push(`${route} → error boundary`);
    const fatal = consoleErrors.filter((text) => !/favicon|404|Download the React DevTools/i.test(text));
    if (fatal.length > 0) failures.push(`${route} → console: ${fatal[0]}`);
  } catch (error) {
    failures.push(`${route} → ${String(error).split("\n")[0].slice(0, 100)}`);
  } finally {
    page.off("console", onError);
  }
}
await browser.close();

if (failures.length > 0) {
  console.error(`Render check failed on ${failures.length} of ${routes.length} tool pages:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Render check passed: ${routes.length} tool widgets mounted cleanly.`);
}
