import { expect, type Page, test } from "@playwright/test";

// 1x1 transparent PNG, used for note image + avatar uploads (objects).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// Navigate and wait for TanStack Start to hydrate before interacting — otherwise
// a fast fill+submit hits the SSR'd form before its JS handler attaches and the
// browser does a native GET. (networkidle is unusable: Vite dev keeps an HMR
// websocket open, so it never settles.)
async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  await page.locator("form, main").first().waitFor();
  await page.waitForTimeout(1200);
}

test("full demo flow lights every primitive", async ({ page }) => {
  const email = `user-${Date.now()}@example.com`;
  const password = "password-12345";

  // --- Auth: sign up -> gated dashboard ---
  await gotoHydrated(page, "/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Your notes" })).toBeVisible();

  // --- Postgres + Objects + Queue: create a note with an image ---
  await page.getByPlaceholder("Title").fill("My first note");
  await page.getByPlaceholder("Write something…").fill("hello from the beyond stack");
  await page.locator('input[type="file"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("button", { name: /add note/i }).click();

  const note = page.locator("li", { hasText: "My first note" });
  await expect(note).toBeVisible({ timeout: 15000 });

  // --- Queue worker: pending -> processed with a word count (pg write-back) ---
  await expect(note.getByText(/processed · \d+ words/)).toBeVisible({ timeout: 30_000 });
  // body "hello from the beyond stack" = 5 words
  await expect(note.getByText("processed · 5 words")).toBeVisible();

  // Note image rendered from Objects (public URL).
  await expect(note.locator("img")).toBeVisible();

  // --- KV: dashboard count cache ---
  await expect(page.getByText(/\d+ total \(cached in KV\)/)).toBeVisible();

  // --- Objects: avatar upload on profile ---
  await gotoHydrated(page, "/profile");
  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.locator("main img").first()).toBeVisible({ timeout: 15_000 });
});

test("KV rate limit blocks rapid note creation", async ({ page }) => {
  const email = `rl-${Date.now()}@example.com`;
  await gotoHydrated(page, "/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-12345");
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15000 });

  // Limit is 10/min/user; the 11th create should surface the rate-limit error.
  for (let i = 0; i < 12; i++) {
    await page.getByPlaceholder("Title").fill(`note ${i}`);
    await page.getByRole("button", { name: /add note/i }).click();
    await page.waitForTimeout(150);
    const err = page.getByText(/rate limit reached/i);
    if (await err.isVisible().catch(() => false)) return; // hit the limit — pass
  }
  throw new Error("expected the KV rate limit to trigger within 12 creates");
});
