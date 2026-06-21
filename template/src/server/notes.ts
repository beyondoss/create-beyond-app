import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { notes, type Note } from "../db/schema";
import { getCurrentUser } from "../lib/auth.server";
import { kv } from "../lib/kv.server";
import { queue, NOTE_QUEUE } from "../lib/queue.server";

const RATE_LIMIT = 10; // notes created per minute, per user
const COUNT_TTL = 30; // seconds to cache the dashboard note count

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export const listNotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ notes: Note[]; count: number }> => {
    const user = await requireUser();

    const rows = await db
      .select()
      .from(notes)
      .where(eq(notes.userId, user.userId))
      .orderBy(desc(notes.createdAt));

    // KV cache: serve a cached count when warm, otherwise populate it.
    const countKey = `notes:count:${user.userId}`;
    let count = rows.length;
    const cached = await kv.get(countKey);
    if (cached.data) {
      count = Number(cached.data.text());
    } else {
      await kv.set(countKey, String(rows.length), { ttl: COUNT_TTL });
    }

    return { notes: rows, count };
  },
);

export const createNote = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1, "Title is required.").max(200),
      body: z.string().max(10_000).default(""),
      imageKey: z.string().optional(),
      imageUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: true; note: Note } | { ok: false; error: string }> => {
    const user = await requireUser();

    // KV rate limit: a per-user, per-minute counter with a short TTL.
    const rlKey = `notes:rl:${user.userId}`;
    await kv.set(rlKey, "0", { ttl: 60, ifAbsent: true });
    const { data: hits } = await kv.incr(rlKey);
    if (typeof hits === "number" && hits > RATE_LIMIT) {
      return { ok: false, error: "Rate limit reached — slow down a moment." };
    }

    // Insert the note and enqueue a processing job. Beyond's queue is pgmq, so
    // you can make this atomic by calling pgmq's `send` inside the same DB
    // transaction; here we keep it simple and enqueue right after the insert.
    const [note] = await db
      .insert(notes)
      .values({
        userId: user.userId,
        title: data.title,
        body: data.body ?? "",
        imageKey: data.imageKey ?? null,
        imageUrl: data.imageUrl ?? null,
        status: "pending",
      })
      .returning();

    // The queue is created once by the worker at boot — just enqueue here.
    await queue.messages.send(NOTE_QUEUE, { noteId: note.id });

    // Invalidate the cached count so the dashboard reflects the new note.
    await kv.delete(`notes:count:${user.userId}`).catch(() => {});

    return { ok: true, note };
  });
