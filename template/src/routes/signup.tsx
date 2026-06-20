import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signUp } from "@/server/auth";
import { AuthCard } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const res = await signUp({
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
      title="Create your account"
      description="Start building on Beyond."
      cta="Sign up"
      pending={pending}
      error={error}
      onSubmit={onSubmit}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    />
  );
}
