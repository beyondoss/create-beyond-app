// Env-driven Queue singleton (reads BEYOND_QUEUE_URL). Server-only.
import { queue } from "@beyond.dev/queue";

/** Queue that carries note-processing jobs. */
export const NOTE_QUEUE = "process-note";

export { queue };
