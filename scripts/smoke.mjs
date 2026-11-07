import { spawn } from "node:child_process";

const port = 3100;
const base = `http://127.0.0.1:${port}`;
// Spawn Next directly: going through `npm` leaves a shell wrapper whose kill()
// does not reach the server child, so the port stayed occupied after the run.
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  stdio: "ignore",
});

function stop() {
  if (!server.killed) server.kill();
}

/** Anything React renders instead of the page when a component throws. */
const FAILURE_MARKERS = [
  "hit an unexpected error",
  "Application error: a client-side exception",
  "This page could not be found",
];

try {
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

  // The sitemap is generated from the registry, so this covers every tool,
  // category and static page without a second list to keep in sync.
  const sitemap = await fetch(`${base}/sitemap.xml`);
  if (!sitemap.ok) throw new Error("sitemap.xml did not respond.");
  const routes = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]).pathname)
    .filter((path, index, all) => all.indexOf(path) === index);
  if (routes.length < 60) {
    throw new Error(`Sitemap only listed ${routes.length} routes — expected the whole catalogue.`);
  }

  const failures = [];
  let toolPages = 0;
  for (const route of routes) {
    const response = await fetch(`${base}${route}`);
    if (!response.ok) {
      failures.push(`${route} → HTTP ${response.status}`);
      continue;
    }
    const html = await response.text();
    const marker = FAILURE_MARKERS.find((text) => html.includes(text));
    if (marker) {
      failures.push(`${route} → rendered an error page ("${marker}")`);
      continue;
    }
    if (!html.includes("<h1")) {
      failures.push(`${route} → no h1 in the document`);
      continue;
    }
    // Tool pages are /category-slug/tool-id and must carry the workspace anchor.
    const segments = route.split("/").filter(Boolean);
    if (segments.length === 2 && segments[0].endsWith("-tools")) {
      toolPages += 1;
      if (!html.includes('id="workspace"')) {
        failures.push(`${route} → tool page without a workspace`);
      }
    }
  }

  const headers = await fetch(`${base}/`);
  for (const [name, expected] of [
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "DENY"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
  ]) {
    if (headers.headers.get(name) !== expected) {
      failures.push(`Missing expected ${name} security header.`);
    }
  }

  if (failures.length > 0) {
    console.error(`Smoke test failed on ${failures.length} of ${routes.length} routes:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Smoke test passed: ${routes.length} routes, ${toolPages} tool pages, security headers present.`);
  }
} finally {
  stop();
}
