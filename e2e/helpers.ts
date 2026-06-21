import { expect, type Page } from "@playwright/test";

// 1x1 transparent PNG for object uploads.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export const PASSWORD = "password-12345";

let seq = 0;
export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${seq++}@example.com`;

// Navigate and wait for TanStack Start to hydrate before interacting — otherwise a
// fast fill+submit hits the SSR'd form before its JS handler attaches and the
// browser does a native GET. (networkidle is unusable: Vite dev keeps an HMR
// websocket open, so it never settles.)
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  await page.locator("form, main").first().waitFor();
  await page.waitForTimeout(1200);
}

export async function signUp(page: Page, email: string, password = PASSWORD) {
  await gotoHydrated(page, "/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await gotoHydrated(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

export async function addNote(page: Page, title: string, body = "") {
  await page.getByPlaceholder("Title").fill(title);
  if (body) await page.getByPlaceholder("Write something…").fill(body);
  await page.getByRole("button", { name: /add note/i }).click();
}
