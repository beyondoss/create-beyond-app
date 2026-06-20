import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * A note belongs to a user (the stable `user.id` from Beyond Auth). On create we
 * enqueue a `process-note` job; the background worker fills in `wordCount` and
 * flips `status` to "processed".
 */
export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  wordCount: integer("word_count"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
