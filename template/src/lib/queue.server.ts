// Env-driven Queue singleton (reads BEYOND_QUEUE_URL). Server-only.
import { queue } from "@beyond.dev/queue";

/** Queue that carries note-processing jobs. (Names must match [a-z0-9_].) */
export const NOTE_QUEUE = "process_note";

export { queue };
