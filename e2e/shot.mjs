#!/usr/bin/env node
// Screenshot the running app (http://localhost:5173) across the key screens.
// Usage: pnpm shot   (after `pnpm e2e:up` + the app dev server is running)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.APP_URL ?? "http://localhost:5173";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "screens");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const go = async (path) => {
  await page.goto(BASE + path);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200); // let TanStack Start hydrate
};
const shot = (name) => page.screenshot({ path: join(outDir, name + ".png") });

await go("/");
await shot("1-landing");

await go("/signup");
await shot("2-signup");
await page.getByLabel("Email").fill(`demo-${Date.now()}@example.com`);
await page.getByLabel("Password").fill("password-12345");
await page.getByRole("button", { name: /sign up/i }).click();
await page.waitForURL(/\/app$/, { timeout: 15000 });
await page.waitForTimeout(800);
await shot("3-dashboard-empty");

await page.getByPlaceholder("Title").fill("Hello Beyond");
await page.getByPlaceholder("Write something…").fill("this note is processed by the queue worker");
await page.getByRole("button", { name: /add note/i }).click();
await page.waitForTimeout(4000); // let the queue worker process it
await shot("4-dashboard-note");

await go("/profile");
await shot("5-profile");

await browser.close();
console.log("screenshots written to e2e/screens/");
