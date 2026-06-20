import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/server/auth";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn({
      data: {
        email: String(form.get("email")),
        password: String(form.get("password")),
      },
    });
    setPending(false);
    if (res.ok) navigate({ to: "/app" });
    else setError(res.error);
  }

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back."
      onSubmit={onSubmit}
      error={error}
      pending={pending}
      cta="Sign in"
      footer={
        <>
          No account?{" "}
          <Link to="/signup" className="font-medium underline underline-offset-4">
            Create one
          </Link>
        </>
      }
    />
  );
}

export function AuthCard(props: {
  title: string;
  description: string;
  cta: string;
  pending: boolean;
  error: string | null;
  footer: React.ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={props.onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {props.error && <p className="text-destructive text-sm">{props.error}</p>}
            <Button type="submit" className="w-full" disabled={props.pending}>
              {props.pending ? "…" : props.cta}
            </Button>
          </form>
          <p className="text-muted-foreground mt-6 text-sm">{props.footer}</p>
        </CardContent>
      </Card>
    </main>
  );
}
