import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  auth,
  getCurrentUser,
  setSessionCookie,
  clearSessionCookie,
  type CurrentUser,
} from "../lib/auth.server";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(12, "Password must be at least 12 characters."),
});

export type AuthActionResult = { ok: true } | { ok: false; error: string };

export const signUp = createServerFn({ method: "POST" })
  .validator(credentials)
  .handler(async ({ data }): Promise<AuthActionResult> => {
    const { data: res, error } = await auth.flow.signUp({
      email: data.email,
      password: data.password,
    });
    if (error || !res) {
      return { ok: false, error: error?.message ?? "Could not create account." };
    }
    setSessionCookie(res.session.token);
    return { ok: true };
  });

export const signIn = createServerFn({ method: "POST" })
  .validator(credentials)
  .handler(async ({ data }): Promise<AuthActionResult> => {
    const { data: res, error } = await auth.flow.signIn({
      grantType: "password",
      email: data.email,
      password: data.password,
    });
    if (error || !res) {
      return { ok: false, error: error?.message ?? "Invalid email or password." };
    }
    if (!("session" in res)) {
      // A step-up challenge (TOTP/passkey) was returned. The starter doesn't
      // implement step-up — extend auth.flow.completeTotpStepUp(...) to support it.
      return { ok: false, error: "Additional verification is required for this account." };
    }
    setSessionCookie(res.session.token);
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const user = await getCurrentUser();
  if (user) await auth.flow.signOut(user.token).catch(() => {});
  clearSessionCookie();
  return { ok: true } as const;
});

export const fetchCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => getCurrentUser(),
);
