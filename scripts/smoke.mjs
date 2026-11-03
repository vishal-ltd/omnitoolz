import { spawn } from "node:child_process";

const port = 3100;
const base = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
  stdio: "ignore",
  shell: true,
});

function stop() {
  if (!server.killed) server.kill();
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
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

  const routes = ["/", "/pdf-tools/merge-pdf", "/contact", "/security", "/sitemap.xml"];
  for (const route of routes) {
    const response = await fetch(`${base}${route}`);
    if (!response.ok) throw new Error(`${route} returned HTTP ${response.status}.`);
  }

  const headers = await fetch(`${base}/`);
  for (const [name, expected] of [
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "DENY"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
  ]) {
    if (headers.headers.get(name) !== expected) {
      throw new Error(`Missing expected ${name} security header.`);
    }
  }

  console.log(`Smoke test passed for ${routes.length} production routes.`);
} finally {
  stop();
}
