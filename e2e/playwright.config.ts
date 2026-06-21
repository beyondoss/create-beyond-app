import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dirname, "..", ".beyond-stack", "app");

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    // The generated app's own `pnpm dev`: docker compose up (pulls the published
    // ghcr.io/beyondoss/beyond-* images) + drizzle migrate + vite. This exercises
    // exactly what an end user gets — no building primitives from source.
    command: "pnpm dev",
    cwd: appDir,
    url: "http://localhost:5173",
    // Generous: first run pulls 5 images before the app comes up.
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
