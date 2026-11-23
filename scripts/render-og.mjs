/**
 * Regenerate public/og.png (1200×630 Open Graph image) from scripts/og-src.html.
 *
 *   node scripts/render-og.mjs
 *
 * Requires the dev dependency `puppeteer`. The source HTML loads its pixel font
 * from jsDelivr, so this needs network access.
 */
import puppeteer from "puppeteer";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = pathToFileURL(path.join(root, "scripts", "og-src.html")).href;
const out = path.join(root, "public", "og.png");

const browser = await puppeteer.launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.goto(src, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}