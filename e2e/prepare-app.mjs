#!/usr/bin/env node
// Scaffold (or fast-resync) the app into .beyond-stack/app. The app's own
// `pnpm dev` (docker compose of published images + migrate + vite) provides the
// stack — Playwright's webServer runs it. First run scaffolds via the generator
// (installs deps); later runs just copy template/ over so iteration is instant.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, ".beyond-stack", "app");
const templateDir = join(root, "template");

if (existsSync(join(appDir, "node_modules"))) {
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

console.log("[prepare-app] ready (run via `pnpm e2e`)");
