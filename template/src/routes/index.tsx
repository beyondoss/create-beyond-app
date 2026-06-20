import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: Home,
});

const PRIMITIVES = [
  ["Postgres", "Drizzle schema + migrations, served via PgBouncer"],
  ["Auth", "Sign up, sign in, session-gated routes"],
  ["Objects", "Public image + avatar uploads"],
  ["Queue", "Transactional-style enqueue + a background worker"],
  ["KV", "Dashboard count cache + per-user rate limit"],
];

function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
        create-beyond-app
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">
        Your full stack is already wired.
      </h1>
      <p className="text-muted-foreground mt-4 text-lg">
        A TanStack Start app pre-connected to Beyond Postgres, Auth, KV, Queue,
        and Objects. Sign up and create a note to light up every primitive.
      </p>

      <div className="mt-8 flex gap-3">
        <Button asChild size="lg">
          <Link to="/signup">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>

      <div className="mt-14 grid gap-3 sm:grid-cols-2">
        {PRIMITIVES.map(([name, desc]) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle>{name}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{desc}</CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
