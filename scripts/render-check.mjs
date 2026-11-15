/**
 * Browser-level render check. The HTTP smoke test only sees server HTML, and
 * tool widgets are client-only (ssr: false), so a widget that throws on mount
 * would slip through. This visits every tool route in a real browser and
 * asserts the workspace actually mounted.
 *
 *   node scripts/render-check.mjs            # boots a production server itself
 *   node scripts/render-check.mjs http://localhost:3000   # against a running server
 *
 * Skips with a message when Puppeteer is not installed, except under CI where a
 * missing browser is a failure rather than a free pass.
 */
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const port = Number(process.env.RENDER_CHECK_PORT ?? 3101);
const base = process.argv[2] ?? `http://127.0.0.1:${port}`;

// When no URL is given, boot a production server ourselves (same approach as
// smoke.mjs: spawn Next directly so kill() reaches the server child, and the
// port is never left occupied).
let server = null;
if (!process.argv[2]) {
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
    { stdio: "ignore" },
  );
}

function stop() {
  if (server && !server.killed) server.kill();
}

let skipped = false;

try {
  if (server) {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const response = await fetch(`${base}/`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // The server may still be starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error("Production server did not become ready.");
  }

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
    // A silent skip in CI would report green without having checked anything.
    if (process.env.CI) {
      console.error("render-check: Puppeteer is required in CI but could not be loaded.");
      process.exitCode = 1;
    } else {
      console.log("render-check skipped: Puppeteer is not installed (npm i -D puppeteer to enable).");
    }
    skipped = true;
  } else {
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
    } else if (!skipped) {
      console.log(`Render check passed: ${routes.length} tool widgets mounted cleanly.`);
    }
  }
} finally {
  stop();
}
