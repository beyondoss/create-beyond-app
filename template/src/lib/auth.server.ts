// Server-only auth helpers built on the Beyond Auth SDK.
//
// Cookies use the SDK's hardened helpers: `__Host-`/`Secure` in production and a
// plain `session` cookie in dev (`secure: false`) so the session works over
// http://localhost. `getSessionToken` reads whichever is present.
import { auth, createAuthClient } from "@beyond.dev/auth";
import { clearCookieAttrs, getSessionToken, sessionCookieAttrs } from "@beyond.dev/auth/server";
import { getRequest, setCookie } from "@tanstack/react-start/server";

const isProd = process.env.NODE_ENV === "production";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface CurrentUser {
  token: string;
  userId: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

function applyCookie(attrs: ReturnType<typeof sessionCookieAttrs>): void {
  setCookie(attrs.name, attrs.value, {
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    path: attrs.path,
    maxAge: attrs.maxAge,
    domain: attrs.domain,
  });
}

export function setSessionCookie(token: string): void {
  applyCookie(sessionCookieAttrs(token, { secure: isProd, maxAge: MAX_AGE }));
}

export function clearSessionCookie(): void {
  applyCookie(clearCookieAttrs({ secure: isProd }));
}

/**
 * Resolves the signed-in user from the session cookie. Returns `null` when there
 * is no session or the token is invalid/expired. `me.get()` both validates the
 * token and returns the profile (stable `user.id`, name, email, avatar).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = getSessionToken(getRequest());
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
