import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fileToUpload } from "@/lib/file";
import { fetchCurrentUser } from "@/server/auth";
import { uploadAvatar } from "@/server/uploads";

export const Route = createFileRoute("/_authed/profile")({
  loader: async () => ({ user: await fetchCurrentUser() }),
  component: Profile,
});

function Profile() {
  const { user } = Route.useLoaderData();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    const res = await uploadAvatar({ data: await fileToUpload(file) });
    setPending(false);
    if (!res.ok) setError(res.error);
    else router.invalidate();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card className="mt-6">
        <CardContent className="flex items-center gap-5">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="size-20 rounded-full object-cover" />
          ) : (
            <span className="bg-muted grid size-20 place-items-center rounded-full text-2xl">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-muted-foreground text-sm">{user?.email}</div>
            <Button asChild variant="outline" size="sm" className="mt-3" disabled={pending}>
              <label className="cursor-pointer">
                {pending ? "Uploading…" : "Change avatar"}
                <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
              </label>
            </Button>
            {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
