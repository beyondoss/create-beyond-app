#!/usr/bin/env node
// One-command local dev: bring up the primitive stack, scaffold the app wired to
// it, and run the app dev server (with the stack env injected) on :5173.
//
//   pnpm dev:local
//
// Then edit template/, run `node e2e/prepare-app.mjs` to re-sync, and the app
// (and `pnpm shot`) reflect your changes.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, ".beyond-stack", "app");

execFileSync("node", ["bin/dev-stack.mjs", "up"], { cwd: root, stdio: "inherit" });
execFileSync("node", ["e2e/prepare-app.mjs"], { cwd: root, stdio: "inherit" });

// Vite doesn't load .env into the SSR process.env, so inject the stack env here.
const env = { ...process.env };
for (const line of readFileSync(join(root, ".beyond-stack", "app.env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

console.log("\n[dev:local] starting app on http://localhost:5173 (Ctrl-C to stop)\n");
const child = spawn("pnpm", ["dev"], { cwd: appDir, stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
