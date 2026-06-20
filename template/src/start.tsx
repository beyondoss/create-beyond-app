import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({}));

// Start the in-process queue worker once, on the server only. Vite strips this
// branch (and the server-only worker module) from the client bundle.
if (import.meta.env.SSR) {
  void import("./lib/worker").then((m) => m.startWorker());
}
