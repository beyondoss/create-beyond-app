# Beyond app

A full-stack [TanStack Start](https://tanstack.com/start) app, pre-wired to the
Beyond platform primitives. Sign up, create a note with an image, and watch every
primitive light up.

## Run it

```bash
beyond dev        # full stack (Postgres, Auth, KV, Queue, Objects) + HMR
# or, outside the Beyond CLI, set the BEYOND_* vars in .env and:
pnpm dev
```

`beyond` injects `DATABASE_URL` and the `BEYOND_*` env vars automatically. See
`.env.example` for what they are.

## What's wired

| Primitive | Where | What it does |
| --- | --- | --- |
| **Postgres** | `src/db/` (Drizzle) | `notes` table; migrations in `drizzle/` |
| **Auth** | `src/lib/auth.server.ts`, `src/server/auth.ts` | email/password sign-up, sign-in, session cookie, route gate |
| **Objects** | `src/server/uploads.ts` | public note images + profile avatars |
| **Queue** | `src/lib/queue.server.ts`, `src/lib/worker.ts` | enqueue a job on note create; worker computes word count |
| **KV** | `src/server/notes.ts` | dashboard count cache + per-user create rate limit |

## How it fits together

- **Routes** live in `src/routes/` (file-based). `_authed.tsx` gates everything
  under it by loading the current user and redirecting to `/login` if absent.
- **Server functions** (`src/server/*.ts`) are the only code that touches the
  primitives — the SDKs are server-only. The browser calls them as typed RPCs.
- **The worker** (`src/lib/worker.ts`) is started once on the server from
  `src/start.tsx`. Creating a note enqueues a `process-note` job; the worker
  picks it up, computes the word count, and flips the note's status to
  `processed`. Reload the dashboard to see it update.

## Migrations

Migrations are **generated locally** and **applied during the build** — which is
where the Beyond repo agent runs them:

```bash
pnpm db:generate   # after editing src/db/schema.ts → writes SQL to drizzle/
pnpm db:migrate    # apply (also runs automatically in `build` and `dev`)
```

Because the build runs migrations, a fork inherits the already-migrated schema
through the copy-on-write volume — so `beyond fork` gives you production's schema
and data, instantly.

## UI

Styled with [Tailwind CSS v4](https://tailwindcss.com) and
[shadcn/ui](https://ui.shadcn.com). Base components live in `src/components/ui`;
add more with `pnpm dlx shadcn@latest add <component>` (configured in
`components.json`, `@/` → `src/`).

## Extending

- Add a primitive call inside a server function — the singletons (`kv`, `queue`,
  `objects`, `auth`) are already imported and env-configured.
- The queue is pgmq, so you can make enqueue **atomic** with the insert by
  calling pgmq's `send` inside the same Drizzle transaction (see the comment in
  `src/server/notes.ts`).
- Auth supports OAuth, magic links, passkeys, and TOTP step-up via
  `auth.flow.*` — wire the ones you need.
