// Server-only auth helpers built on the Beyond Auth SDK.
//
// We manage our own httpOnly cookie (`beyond_session`) rather than the SDK's
// `__Host-` cookie: `__Host-` requires HTTPS, which breaks `localhost` dev.
import { auth, createAuthClient } from "@beyond.dev/auth";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const COOKIE = "beyond_session";
const isProd = process.env.NODE_ENV === "production";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface CurrentUser {
  token: string;
  userId: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

export function setSessionCookie(token: string): void {
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(): void {
  deleteCookie(COOKIE, { path: "/" });
}

/**
 * Resolves the signed-in user from the session cookie. Returns `null` when there
 * is no session or the token is invalid/expired. `me.get()` both validates the
 * token and returns a stable `user.id` to own data by.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;

  const client = createAuthClient({ token });
  const { data, error } = await client.me.get();
  if (error || !data) return null;

  return {
    token,
    userId: data.user.id,
    name: data.user.name,
    email: data.email.email,
    imageUrl: data.user.imageUrl ?? null,
  };
}

export { auth };
