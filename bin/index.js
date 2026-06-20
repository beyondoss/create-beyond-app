#!/usr/bin/env node
// create-beyond-app — zero-dependency scaffolder.
// Copies the bundled template/ into a new directory, personalizes it, and installs deps.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const templateDir = join(here, "..", "template");

// Minimal ANSI helpers (no dependency on picocolors etc.)
const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

// Files copied verbatim but renamed (npm strips a real .gitignore from published packages).
const RENAME = { _gitignore: ".gitignore", "_env.example": ".env.example" };

const VALID_NAME = /^[a-z0-9][a-z0-9._-]*$/;

async function prompt(question, fallback) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const renamed = RENAME[entry] ?? entry;
    const to = join(dest, renamed);
    if (statSync(from).isDirectory()) {
      // node_modules / dist should never exist in the template, but guard anyway.
      if (entry === "node_modules" || entry === "dist" || entry === ".output") continue;
      copyDir(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

function setPackageName(dir, name) {
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = name;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

async function main() {
  console.log();
  console.log(c.bold(c.cyan("create-beyond-app")));
  console.log(c.dim("A primitive-aware full-stack starter for Beyond.\n"));

  if (!existsSync(templateDir)) {
    console.error(c.red("Template not found. This is a packaging bug — please report it."));
    process.exit(1);
  }

  let target = process.argv[2];
  if (!target) {
    target = await prompt(`${c.bold("Project directory")} ${c.dim("(my-beyond-app)")}: `, "my-beyond-app");
  }

  const destDir = resolve(process.cwd(), target);
  const appName = basename(destDir);

  if (!VALID_NAME.test(appName)) {
    console.error(c.red(`"${appName}" is not a valid npm package name (lowercase letters, digits, -, _, .).`));
    process.exit(1);
  }
  if (existsSync(destDir) && readdirSync(destDir).length > 0) {
    console.error(c.red(`Directory "${target}" already exists and is not empty.`));
    process.exit(1);
  }

  console.log(`\nScaffolding into ${c.cyan(destDir)} ...`);
  copyDir(templateDir, destDir);
  setPackageName(destDir, appName);

  const skipInstall = process.argv.includes("--no-install");
  if (!skipInstall) {
    console.log("Installing dependencies with pnpm ...\n");
    const result = spawnSync("pnpm", ["install"], { cwd: destDir, stdio: "inherit" });
    if (result.status !== 0) {
      console.log(
        c.red("\nDependency install failed. Make sure pnpm is installed (https://pnpm.io/installation), then run `pnpm install`."),
      );
    }
  }

  console.log(c.green("\nDone! Your Beyond app is ready.\n"));
  console.log("Next steps:");
  console.log(c.cyan(`  cd ${target}`));
  if (skipInstall) console.log(c.cyan("  pnpm install"));
  console.log(c.cyan("  beyond dev") + c.dim("   # full stack (Postgres, Auth, KV, Queue, Objects) + HMR"));
  console.log(c.dim("\nNo Beyond CLI yet? `pnpm dev` works against the BEYOND_* env in .env.\n"));
}

main().catch((err) => {
  console.error(c.red(String(err?.stack || err)));
  process.exit(1);
});
