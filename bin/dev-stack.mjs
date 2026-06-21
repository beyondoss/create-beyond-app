#!/usr/bin/env node
// dev-stack: stand up the Beyond primitive stack locally + in CI, offline from
// Beyond's servers. Clones the four primitive repos JIT, builds Docker images
// from source, and runs them via docker-compose.
//
//   node bin/dev-stack.mjs up     # clone + build + start + wait healthy + write env
//   node bin/dev-stack.mjs down   # stop + remove volumes
//   node bin/dev-stack.mjs env    # print the app env for the running stack

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const harness = join(root, "harness");
const stackDir = join(root, ".beyond-stack");
const reposDir = join(stackDir, "repos");
const compose = join(harness, "docker-compose.yml");
const ORG = "https://github.com/beyondoss";

const REPOS = [
  { name: "auth", bin: "beyond-auth", image: "beyond-local/auth:dev" },
  { name: "kv", bin: "beyond-kv", image: "beyond-local/kv:dev" },
  { name: "queue", bin: "beyond-queue", image: "beyond-local/queue:dev" },
  { name: "objects", bin: "beyond-objects", image: "beyond-local/objects:dev" },
];

const APP_ENV = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/app",
  BEYOND_AUTH_URL: "http://localhost:8080",
  BEYOND_AUTH_ADMIN_SECRET: "test-admin-secret",
  BEYOND_KV_URL: "redis://localhost:6379",
  BEYOND_QUEUE_URL: "http://localhost:4566",
  BEYOND_OBJECTS_URL: "http://localhost:9000",
  BEYOND_OBJECTS_ROOT_TOKEN: "local-root-token",
};

const HEALTH = [
  { name: "postgres", tcp: 5432 },
  { name: "auth", url: "http://localhost:8080/readyz" },
  { name: "kv", url: "http://localhost:4869/livez" },
  { name: "queue", url: "http://localhost:4566/livez" },
  { name: "objects", url: "http://localhost:9000/livez" },
];

const env = { ...process.env, DOCKER_BUILDKIT: "1", COMPOSE_DOCKER_CLI_BUILD: "1" };

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${r.status ?? r.signal}`);
  }
}

function refs() {
  const out = {};
  const file = join(harness, "versions.env");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return {
    auth: process.env.AUTH_REF ?? out.AUTH_REF ?? "main",
    kv: process.env.KV_REF ?? out.KV_REF ?? "main",
    queue: process.env.QUEUE_REF ?? out.QUEUE_REF ?? "main",
    objects: process.env.OBJECTS_REF ?? out.OBJECTS_REF ?? "main",
  };
}

function cloneOrUpdate(name, ref) {
  const dir = join(reposDir, name);
  if (!existsSync(dir)) {
    console.log(`\n[dev-stack] cloning ${name}@${ref}`);
    run("git", ["clone", "--filter=blob:none", `${ORG}/${name}.git`, dir]);
  } else {
    console.log(`\n[dev-stack] updating ${name}@${ref}`);
    run("git", ["-C", dir, "fetch", "--all", "--tags", "--quiet"]);
  }
  run("git", ["-C", dir, "checkout", "--quiet", ref]);
  // Move to the latest commit if ref is a branch (no-op for tags/shas).
  spawnSync("git", ["-C", dir, "reset", "--hard", `origin/${ref}`, "--quiet"], { env });
}

function imageExists(ref) {
  return spawnSync("docker", ["image", "inspect", ref], { env, stdio: "ignore" }).status === 0;
}

function buildImages() {
  const force = process.env.REBUILD === "1";
  for (const r of REPOS) {
    if (!force && imageExists(r.image)) {
      console.log(`[dev-stack] ${r.image} exists — skipping build (REBUILD=1 to force)`);
      continue;
    }
    console.log(`\n[dev-stack] building ${r.image}`);
    run("docker", [
      "build",
      "-f", join(harness, "Dockerfile.server"),
      "--build-arg", `BIN=${r.bin}`,
      "-t", r.image,
      join(reposDir, r.name),
    ]);
  }
  if (!force && imageExists("beyond-local/postgres:dev")) {
    console.log("[dev-stack] beyond-local/postgres:dev exists — skipping build (REBUILD=1 to force)");
    return;
  }
  console.log(`\n[dev-stack] building beyond-local/postgres:dev (auth ext + queue schema)`);
  run("docker", [
    "build",
    "-f", join(harness, "Dockerfile.postgres"),
    "--build-context", `queue=${join(reposDir, "queue")}`,
    "--build-context", `harness=${harness}`,
    "-t", "beyond-local/postgres:dev",
    join(reposDir, "auth"),
  ]);
}

function tcpOk(port) {
  return new Promise((res) => {
    const s = net.connect({ host: "127.0.0.1", port }, () => { s.destroy(); res(true); });
    s.on("error", () => res(false));
    s.setTimeout(1000, () => { s.destroy(); res(false); });
  });
}

async function httpOk(url) {
  try {
    const r = await fetch(url);
    return r.ok;
  } catch {
    return false;
  }
}

async function waitHealthy(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  const pending = new Set(HEALTH.map((h) => h.name));
  while (Date.now() < deadline && pending.size) {
    for (const h of HEALTH) {
      if (!pending.has(h.name)) continue;
      const ok = h.tcp ? await tcpOk(h.tcp) : await httpOk(h.url);
      if (ok) {
        pending.delete(h.name);
        console.log(`[dev-stack] ✓ ${h.name} healthy`);
      }
    }
    if (pending.size) await new Promise((r) => setTimeout(r, 1500));
  }
  if (pending.size) {
    run("docker", ["compose", "-f", compose, "ps"]);
    throw new Error(`stack did not become healthy: ${[...pending].join(", ")}`);
  }
}

function writeEnv() {
  const body = Object.entries(APP_ENV).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  writeFileSync(join(stackDir, "app.env"), body);
}

async function up() {
  mkdirSync(reposDir, { recursive: true });
  const r = refs();
  for (const repo of REPOS) cloneOrUpdate(repo.name, r[repo.name]);
  buildImages();
  console.log(`\n[dev-stack] starting stack`);
  run("docker", ["compose", "-f", compose, "up", "-d"]);
  await waitHealthy();
  writeEnv();
  console.log(`\n[dev-stack] stack ready. App env written to .beyond-stack/app.env`);
}

function down() {
  run("docker", ["compose", "-f", compose, "down", "-v"]);
}

const cmd = process.argv[2];
if (cmd === "up") {
  up().catch((e) => { console.error(String(e?.message || e)); process.exit(1); });
} else if (cmd === "down") {
  down();
} else if (cmd === "env") {
  process.stdout.write(Object.entries(APP_ENV).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
} else {
  console.error("usage: dev-stack <up|down|env>");
  process.exit(2);
}
