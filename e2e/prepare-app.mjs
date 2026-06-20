#!/usr/bin/env node
// Scaffold a fresh app (via the generator) into .beyond-stack/app and point it
// at the running primitive stack. Run AFTER `dev-stack up` and BEFORE Playwright
// so the webServer cwd exists.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, ".beyond-stack", "app");
const envFile = join(root, ".beyond-stack", "app.env");

if (!existsSync(envFile)) {
  console.error("Missing .beyond-stack/app.env — run `node bin/dev-stack.mjs up` first.");
  process.exit(1);
}

if (existsSync(appDir)) rmSync(appDir, { recursive: true, force: true });
console.log("[prepare-app] scaffolding app via generator");
execFileSync("node", ["bin/index.js", join(".beyond-stack", "app")], { cwd: root, stdio: "inherit" });

// Point the app at the local stack (drizzle-kit + the app read .env).
copyFileSync(envFile, join(appDir, ".env"));
console.log("[prepare-app] wrote .beyond-stack/app/.env");
