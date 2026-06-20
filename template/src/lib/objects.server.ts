// Env-driven Objects singleton (reads BEYOND_OBJECTS_URL + BEYOND_OBJECTS_ROOT_TOKEN).
// Server-only — never expose the root token to the browser.
import { objects } from "@beyond.dev/objects";

export { objects };
