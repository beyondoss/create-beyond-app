import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createAuthClient } from "@beyond.dev/auth";
import { getCurrentUser } from "../lib/auth.server";
import { objects } from "../lib/objects.server";

// Files come over the RPC boundary as base64 (simple and reliable for a starter).
const upload = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  dataBase64: z.string().min(1),
});

function decode(dataBase64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(dataBase64, "base64"));
}

/** Upload a public image and return its object key + URL. */
export const uploadImage = createServerFn({ method: "POST" })
  .validator(upload)
  .handler(async ({ data }): Promise<{ ok: true; key: string; url: string } | { ok: false; error: string }> => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const key = `notes/${user.userId}/${Date.now()}-${data.filename}`;
    const { data: res, error } = await objects.put(key, decode(data.dataBase64), {
      contentType: data.contentType,
      access: "public",
    });
    if (error || !res) return { ok: false, error: error?.message ?? "Upload failed." };
    return { ok: true, key: res.key, url: res.url };
  });

/** Upload a public avatar and persist it on the user's auth profile. */
export const uploadAvatar = createServerFn({ method: "POST" })
  .validator(upload)
  .handler(async ({ data }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const key = `avatars/${user.userId}/${Date.now()}-${data.filename}`;
    const { data: res, error } = await objects.put(key, decode(data.dataBase64), {
      contentType: data.contentType,
      access: "public",
    });
    if (error || !res) return { ok: false, error: error?.message ?? "Upload failed." };

    // Persist the avatar URL on the Beyond Auth profile.
    const client = createAuthClient({ token: user.token });
    await client.me.update({ imageUrl: res.url }).catch(() => {});

    return { ok: true, url: res.url };
  });
