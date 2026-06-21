// In-process background worker that drains the note-processing queue.
//
// Demonstrates the full enqueue -> process -> write-back loop on Beyond Queue
// (pgmq). In production this is started once from the server entry; for a real
// workload you'd run it as its own scaled service instead of in-process.
import { eq } from "drizzle-orm";
import { db } from "../db";
import { notes } from "../db/schema";
import { queue, NOTE_QUEUE } from "./queue.server";

let started = false;

/** Idempotently start the consumer loop. Safe to call on every server boot. */
export function startWorker(): void {
  if (started) return;
  started = true;
  void loop();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loop(): Promise<void> {
  // Create the queue if it doesn't exist yet (no-op once it does).
  await queue.queues.create(NOTE_QUEUE).catch(() => {});

  for (;;) {
    try {
      // Push-based wakeup: the server parks this request on a WaitLatch and a
      // committing `send` signals it, so the worker sleeps until a job arrives
      // (returning after `wait`s at most). `visibilityTimeout` hides a claimed
      // message from other workers until it's deleted.
      const { data, error } = await queue.messages.receive(NOTE_QUEUE, {
        max: 10,
        wait: 5,
        visibilityTimeout: 30,
      });
      if (error || !data || data.length === 0) {
        if (error) await sleep(1000);
        continue;
      }
      for (const msg of data) {
        await processOne(msg.id, msg.message as { noteId?: string });
      }
    } catch {
      await sleep(1000);
    }
  }
}

async function processOne(messageId: number, payload: { noteId?: string }): Promise<void> {
  if (payload?.noteId) {
    const [note] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, payload.noteId))
      .limit(1);

    if (note) {
      const trimmed = note.body.trim();
      const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
      await db
        .update(notes)
        .set({ wordCount, status: "processed" })
        .where(eq(notes.id, note.id));
    }
  }
  // Acknowledge the message so it isn't redelivered.
  await queue.messages.delete(NOTE_QUEUE, messageId);
}
