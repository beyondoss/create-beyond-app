import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import { APP_ENV } from "./app-env";

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
    // The scaffolded app's own `pnpm dev` (drizzle migrate + vite), pointed at the
    // primitive stack that `pnpm e2e` brought up (harness/docker-compose.yml).
    command: "pnpm dev",
    cwd: appDir,
    url: "http://localhost:5173",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...APP_ENV },
  },
});
