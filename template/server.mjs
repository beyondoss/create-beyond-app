// Production server: serve the built TanStack Start handler on Node.
// `npm run build` emits dist/server/server.js (a web `fetch` handler); this
// adapter binds it to a port. The Beyond repo agent runs `npm start` in Release.
import { serve } from "@hono/node-server";
import handler from "./dist/server/server.js";

const port = Number(process.env.PORT) || 3000;
serve({ fetch: handler.fetch, port });
console.log(`Server listening on http://0.0.0.0:${port}`);
