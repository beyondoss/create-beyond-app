#!/usr/bin/env node
// Scaffold (or fast-resync) the app into .beyond-stack/app, wired to the running
// primitive stack. First run scaffolds via the generator (installs deps); later
// runs just copy template/ over the app (no reinstall) so iteration is instant
// and Vite HMR picks up the change.
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, ".beyond-stack", "app");
const templateDir = join(root, "template");
const envFile = join(root, ".beyond-stack", "app.env");

if (!existsSync(envFile)) {
  console.error("Missing .beyond-stack/app.env — run `node bin/dev-stack.mjs up` first.");
  process.exit(1);
}

if (existsSync(join(appDir, "node_modules"))) {
  // Fast resync: overlay template files (keep node_modules + .env).
  console.log("[prepare-app] resyncing template -> app (no reinstall)");
  cpSync(templateDir, appDir, {
    recursive: true,
    force: true,
    filter: (src) => !src.includes(`${"/"}node_modules${"/"}`) && !src.endsWith("/node_modules"),
  });
} else {
  console.log("[prepare-app] scaffolding app via generator");
  if (existsSync(appDir)) rmSync(appDir, { recursive: true, force: true });
  execFileSync("node", ["bin/index.js", join(".beyond-stack", "app")], { cwd: root, stdio: "inherit" });
}

// Point the app at the local stack (drizzle-kit + app read .env).
copyFileSync(envFile, join(appDir, ".env"));
console.log("[prepare-app] ready");
