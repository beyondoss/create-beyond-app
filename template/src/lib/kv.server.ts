// Env-driven KV singleton (reads BEYOND_KV_URL). Server-only — the RESP backend
// uses node:net, so never import this from a component.
import { kv } from "@beyond.dev/kv";

export { kv };
