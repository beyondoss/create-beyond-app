import { expect, test } from "@playwright/test";
import { addNote, gotoHydrated, PASSWORD, PNG, signIn, signOut, signUp, uniqueEmail } from "./helpers";

// Granular coverage of each Beyond primitive the template touches. The headline
// integration flow lives in demo.spec.ts; these isolate one behaviour each.

test.describe("auth (Beyond Auth: signup / signin / signout / session gating)", () => {
  test("unauthenticated visit to a gated route redirects to /login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  });

  test("sign up → sign out → sign back in", async ({ page }) => {
    const email = uniqueEmail("auth");
    await signUp(page, email);
    await expect(page.getByText(email)).toBeVisible(); // header shows the session user

    await signOut(page);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 }); // session cleared

    await signIn(page, email);
    await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Your notes" })).toBeVisible();
  });

  test("sign in with the wrong password is rejected", async ({ page }) => {
    const email = uniqueEmail("authbad");
    await signUp(page, email);
    await signOut(page);

    await signIn(page, email, "totally-wrong-9999");
    await expect(page.locator("p.text-destructive")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signing up with an existing email is rejected", async ({ page }) => {
    const email = uniqueEmail("dup");
    await signUp(page, email);
    await signOut(page);

    await gotoHydrated(page, "/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign up/i }).click();
    await expect(page.locator("p.text-destructive")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/signup$/);
  });
});

test.describe("postgres (Drizzle: per-user rows, persistence)", () => {
  test("a created note persists across a reload", async ({ page }) => {
    await signUp(page, uniqueEmail("pg"));
    await addNote(page, "Persisted note", "one two three");
    await expect(page.locator("li", { hasText: "Persisted note" })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("li", { hasText: "Persisted note" })).toBeVisible({ timeout: 15_000 });
  });

  test("notes are isolated per user", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    try {
      await signUp(pageA, uniqueEmail("iso-a"));
      await addNote(pageA, "A's private note");
      await expect(pageA.locator("li", { hasText: "A's private note" })).toBeVisible({ timeout: 15_000 });

      await signUp(pageB, uniqueEmail("iso-b"));
      await expect(pageB.getByText("No notes yet — add your first above.")).toBeVisible({ timeout: 15_000 });
      await expect(pageB.locator("li", { hasText: "A's private note" })).toHaveCount(0);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

test.describe("queue (Beyond Queue + in-process worker)", () => {
  test("a note is processed asynchronously with a word count written back to pg", async ({ page }) => {
    await signUp(page, uniqueEmail("queue"));
    await addNote(page, "Worker note", "alpha beta gamma delta"); // 4 words
    const note = page.locator("li", { hasText: "Worker note" });
    await expect(note).toBeVisible({ timeout: 15_000 });
    // pending → processed, written back by the queue worker.
    await expect(note.getByText("processed · 4 words")).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("objects (Beyond Objects: public upload + serve)", () => {
  test("a note image is stored and served from a public URL", async ({ page, request }) => {
    await signUp(page, uniqueEmail("obj"));
    await page.getByPlaceholder("Title").fill("Image note");
    await page.locator('input[type="file"]').setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: /add note/i }).click();

    const img = page.locator("li", { hasText: "Image note" }).locator("img");
    await expect(img).toBeVisible({ timeout: 15_000 });
    const src = await img.getAttribute("src");
    expect(src).toContain(":9000"); // served by the objects service
    const resp = await request.get(src!); // public — fetchable without auth
    expect(resp.status()).toBe(200);
  });

  test("an uploaded avatar is persisted on the auth profile and shown in the header", async ({ page }) => {
    await signUp(page, uniqueEmail("avatar"));
    await gotoHydrated(page, "/profile");
    await page.locator('input[type="file"]').setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(page.locator("main img").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("header img")).toBeVisible({ timeout: 15_000 }); // persisted to profile
  });
});

test.describe("kv (Beyond KV: cached count + rate limit)", () => {
  test("the dashboard count is cached in KV and reflects new notes", async ({ page }) => {
    await signUp(page, uniqueEmail("kv"));
    await expect(page.getByText("0 total (cached in KV)")).toBeVisible({ timeout: 15_000 });
    await addNote(page, "Count note");
    await expect(page.locator("li", { hasText: "Count note" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("1 total (cached in KV)")).toBeVisible({ timeout: 15_000 });
  });

  test("the per-user rate limit blocks rapid note creation", async ({ page }) => {
    await signUp(page, uniqueEmail("rl"));
    for (let i = 0; i < 12; i++) {
      await page.getByPlaceholder("Title").fill(`note ${i}`);
      await page.getByRole("button", { name: /add note/i }).click();
      await page.waitForTimeout(150);
      if (await page.getByText(/rate limit reached/i).isVisible().catch(() => false)) return;
    }
    throw new Error("expected the KV rate limit to trigger within 12 creates");
  });
});
