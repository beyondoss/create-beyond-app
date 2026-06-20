import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fileToUpload } from "@/lib/file";
import { createNote, listNotes } from "@/server/notes";
import { uploadImage } from "@/server/uploads";

export const Route = createFileRoute("/_authed/app")({
  loader: async () => listNotes(),
  component: Dashboard,
});

function Dashboard() {
  const { notes, count } = Route.useLoaderData();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    let imageKey: string | undefined;
    let imageUrl: string | undefined;
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      const up = await uploadImage({ data: await fileToUpload(file) });
      if (!up.ok) {
        setError(up.error);
        setPending(false);
        return;
      }
      imageKey = up.key;
      imageUrl = up.url;
    }

    const res = await createNote({
      data: {
        title: String(form.get("title")),
        body: String(form.get("body") ?? ""),
        imageKey,
        imageUrl,
      },
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    formEl.reset();
    router.invalidate();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Your notes</h1>
        <span className="text-muted-foreground text-sm">{count} total (cached in KV)</span>
      </div>

      <Card className="mt-6">
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input name="title" required placeholder="Title" />
            <Textarea name="body" rows={3} placeholder="Write something…" />
            <input name="image" type="file" accept="image/*" className="block text-sm" />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add note"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ul className="mt-8 space-y-3">
        {notes.length === 0 && (
          <li className="text-muted-foreground text-sm">No notes yet — add your first above.</li>
        )}
        {notes.map((note) => (
          <li key={note.id}>
            <Card>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{note.title}</h2>
                    {note.body && <p className="text-muted-foreground mt-1 text-sm">{note.body}</p>}
                  </div>
                  <StatusBadge status={note.status} wordCount={note.wordCount} />
                </div>
                {note.imageUrl && (
                  <img src={note.imageUrl} alt="" className="mt-3 max-h-48 rounded-lg object-cover" />
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}

function StatusBadge({ status, wordCount }: { status: string; wordCount: number | null }) {
  const processed = status === "processed";
  return (
    <span
      className={
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
        (processed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")
      }
    >
      {processed ? `processed · ${wordCount ?? 0} words` : "pending…"}
    </span>
  );
}
