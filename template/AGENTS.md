This is a **TanStack Start** full-stack app pre-wired to the **Beyond** (https://beyond.dev) platform
primitives. This file tells you what the stack is, how it's meant to be used, and
the rules to follow so your changes fit in.

## Philosophy

- **Primitives, not a monolith.** The backend is a set of independent Beyond
  primitives — Postgres, Auth, KV, Queue, Objects — each with a small
  `{ data, error }` SDK. You compose them; you don't configure a framework.
- **Server functions are the only backend.** All primitive access happens inside
  TanStack `createServerFn` handlers in `src/server/*.ts`. The browser calls
  these as typed RPCs. There is no separate API layer to build.
- **Server-only SDKs.** The Beyond SDKs use Node APIs (sockets, tokens) and must
  never be imported into a component or client bundle. They live behind
  `src/lib/*.server.ts`.
- **The work-list is the codebase.** Prefer extending the existing patterns
  (a new server function, a new table, a new queue job) over adding new layers.

## Golden rules

1. **Never import `@beyond.dev/*` or `src/lib/*.server.ts` from a component.**
   Touch primitives only inside `src/server/*.ts` (or `src/lib/worker.ts`).
2. **Every SDK call returns `{ data, error }`** — check `error` before using
   `data`. SDKs do not throw for expected failures.
3. **Own every row by the current user.** Get the user with `getCurrentUser()`
   /`requireUser()` and scope DB queries by `user.userId`. Never trust a
   client-supplied user id.
4. **Validate server-fn input** with a Zod `.validator(...)` (see existing ones).
5. **After changing `src/db/schema.ts`, run `pnpm db:generate`** and commit the
   SQL in `drizzle/`. Migrations apply automatically in `dev`/`build`.

## Project map

| Path | What |
| --- | --- |
| `src/routes/` | File-based routes. `_authed.tsx` gates everything under it (loads the user, redirects to `/login` if absent). |
| `src/server/*.ts` | Server functions — the **only** place primitives are used. `auth.ts`, `notes.ts`, `uploads.ts`. |
| `src/lib/*.server.ts` | Env-configured primitive singletons + helpers (`auth`, `kv`, `queue`, `objects`). Server-only. |
| `src/lib/worker.ts` | In-process queue consumer, started once from `src/start.tsx`. |
| `src/db/` | Drizzle: `schema.ts` (tables) + `index.ts` (client). Migrations in `drizzle/`. |
| `src/components/ui/` | shadcn/ui base components. Add more with `pnpm dlx shadcn@latest add <name>`. |

## The Beyond primitives

All singletons are pre-imported and env-configured. Import them from the
`src/lib/*.server.ts` re-exports (not directly from the SDK) inside server code.

### Auth — `@beyond.dev/auth`
Email/password (plus OAuth, magic links, passkeys, TOTP step-up via `auth.flow.*`).
- `auth.flow.signUp({ email, password })`, `auth.flow.signIn({ grantType: "password", email, password })`, `auth.flow.signOut(token)`.
- Per-request user: `createAuthClient({ token }).me.get()` / `.me.update({ imageUrl })`.
- This app keeps its own httpOnly `beyond_session` cookie (see `auth.server.ts`)
  because the SDK's `__Host-` cookie needs HTTPS (breaks localhost). Use
  `getCurrentUser()` to resolve the session; `setSessionCookie` / `clearSessionCookie` to manage it.

### Postgres — Drizzle ORM (`src/db`)
- Define tables in `src/db/schema.ts`; query with `db` from `src/db`.
- `pnpm db:generate` after schema edits → SQL in `drizzle/`; `pnpm db:migrate` applies.
- The DB is shared across primitives via schemas: app tables in `public`, auth in
  `auth`, queue in `queue`. Keep app tables in `public`.

### KV — `@beyond.dev/kv`
- `kv.get(key)` → `{ data }` where `data?.text()` is the value; `kv.set(key, val, { ttl, ifAbsent })`; `kv.incr(key)`; `kv.delete(key)`.
- Used here for the cached dashboard count (`src/server/notes.ts`). Good for caches, counters, locks, ephemeral state.

### Rate limit — `@beyond.dev/rate-limit`
- Per-key limits backed by KV — no counter math. `noteLimiter.limit(key)` → `{ data: { allowed, retryAfter } }` (see `src/lib/rate-limit.server.ts`, used in `createNote`).
- Algorithms: `slidingWindow` (default here, 10/min), `fixedWindow`, `tokenBucket`. Or use the env-driven `rateLimit` singleton (`BEYOND_RATE_LIMIT_*`).

### Queue — `@beyond.dev/queue`
- `queue.queues.create(name)` (idempotent), `queue.messages.send(name, payload)`,
  `queue.messages.receive(name, { max, wait, visibilityTimeout })`, `queue.messages.delete(name, id)`.
- **Queue names must match `[a-z0-9_]`** (see `NOTE_QUEUE`).
- It's pgmq under the hood, so `send` can be made **atomic** with a DB insert by
  enqueuing inside the same Drizzle transaction.
- `receive` is **push-based** (parks on a Postgres WaitLatch, woken by a
  committing `send`) — the worker sleeps until a job arrives, it is not polling.
- The worker (`src/lib/worker.ts`) does `receive → process → delete`. The UI
  refetches while a row is `pending` so the result shows live.

### Objects — `@beyond.dev/objects`
- `objects.put(key, bytes, { contentType, access })` → `{ data: { key, url } }`.
- `access: "public"` returns a directly-fetchable URL (used for note images +
  avatars). Never expose `BEYOND_OBJECTS_ROOT_TOKEN` to the browser.
- Files cross the RPC boundary as base64 in this starter (see `src/server/uploads.ts`).

## More Beyond SDKs (available — not pre-installed)

The five above are wired into this template, but the Beyond platform ships more
`@beyond.dev/*` primitives. **You can add any of these** — they follow the same
conventions (server-only, `{ data, error }`, env-configured). Install with `pnpm
add @beyond.dev/<name>`, then re-export a singleton from a new
`src/lib/<name>.server.ts` and use it inside `src/server/*.ts`, exactly like the
others.

| Package | What it does | Backed by |
| --- | --- | --- |
| `@beyond.dev/cron` | Run scheduled jobs (cron / interval) with handlers | Queue scheduler |
| `@beyond.dev/events` | Publish events to routing keys; subscribe via queues or webhooks (pub/sub) | Events service |
| `@beyond.dev/flags` | Evaluate feature flags with targeting rules | KV (works with the running stack) |

Notes:
- `flags` rides on the **KV** service that's already in the local stack, so it
  works as soon as you install it (like `rate-limit`, which is wired in above).
- `cron` and `events` rely on their own platform services — check the package
  README for the env vars / any local service they expect before depending on
  them locally.
- Don't see what you need? Check the `@beyond.dev` org on npm; the platform is
  primitive-based and the suite grows.

## Common tasks

- **Add a feature with its own data:** add a table to `src/db/schema.ts` →
  `pnpm db:generate` → write a server function in `src/server/` that
  `requireUser()`s and queries `db` scoped by `user.userId` → call it from a
  route loader/handler.
- **Do background work:** `queue.messages.send(QUEUE, payload)` from a server
  function; handle it in `src/lib/worker.ts` (`receive → work → delete`).
- **Cache / count:** use `kv` (`set` with `ttl`, `incr`). **Rate-limit:** `noteLimiter.limit(key)` (`@beyond.dev/rate-limit`).
- **Store a file:** `objects.put(...)` in a server function; render `data.url`.
- **Gate a route:** put it under `src/routes/_authed/`.
- **Add UI:** `pnpm dlx shadcn@latest add <component>` (alias `@/` → `src/`).

## Running

```bash
beyond dev     # the Beyond CLI runs the full local stack (Postgres, Auth, KV, Queue, Objects) + the app
pnpm dev       # just the app: drizzle migrate + vite. Needs the BEYOND_* / DATABASE_URL env
               #   (provided by `beyond dev`, or set them in .env — see .env.example)
pnpm typecheck
```

The **Beyond CLI owns local dev** — it spins up the primitive services and injects
the connection env. `pnpm dev` is only the app process; point it at a stack via the
`BEYOND_*` / `DATABASE_URL` vars.

## Pitfalls

- Importing a `*.server.ts` / `@beyond.dev/*` module from a component → build/runtime breakage. Keep primitives in `src/server/*` and `worker.ts`.
- Forgetting to check `error` before `data` on an SDK call.
- Editing `schema.ts` without `pnpm db:generate` (+ committing `drizzle/`).
- A queue name with characters outside `[a-z0-9_]`.
- Returning unowned data — always scope by `user.userId`.
