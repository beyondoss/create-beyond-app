#!/usr/bin/env node
// `pnpm dev` — bring up the local Beyond stack, wait for it to be healthy, run
// migrations, then start the app. Everything runs locally; no Beyond remote.
import { execFileSync, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Connection details for the local stack (see docker-compose.yml). Vite does not
// load .env into the SSR process.env, so inject them for migrate + the dev server.
const LOCAL_ENV = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/app",
  BEYOND_AUTH_URL: "http://localhost:8080",
  BEYOND_AUTH_ADMIN_SECRET: "test-admin-secret",
  BEYOND_KV_URL: "redis://localhost:6379",
  BEYOND_QUEUE_URL: "http://localhost:4566",
  BEYOND_OBJECTS_URL: "http://localhost:9000",
  BEYOND_OBJECTS_ROOT_TOKEN: "local-root-token",
};
const env = { ...process.env, ...LOCAL_ENV };

function hasDocker() {
  try {
    execFileSync("docker", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!hasDocker()) {
  console.error(
    "\n[dev] No container runtime found.\n" +
      "The local Beyond stack needs a Docker-compatible runtime — install one of:\n" +
      "  Docker Desktop · OrbStack · Podman · Colima · Rancher Desktop\n" +
      "then re-run `pnpm dev`. (Already up? `pnpm dev:app` starts just the app.)\n",
  );
  process.exit(1);
}

console.log("[dev] starting the Beyond stack (pulling images on first run)…");
execFileSync("docker", ["compose", "up", "-d", "--wait"], { cwd: root, stdio: "inherit" });

console.log("[dev] applying database migrations…");
execFileSync("pnpm", ["db:migrate"], { cwd: root, stdio: "inherit", env });

console.log("[dev] starting the app on http://localhost:5173 (Ctrl-C to stop; stack keeps running)…\n");
const child = spawn("pnpm", ["dev:app"], { cwd: root, stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
