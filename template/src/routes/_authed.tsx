import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { fetchCurrentUser, signOut } from "@/server/auth";

export const Route = createFileRoute("/_authed")({
  loader: async () => {
    const user = await fetchCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useLoaderData();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  return (
    <div>
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link to="/app" className="hover:underline" activeProps={{ className: "underline" }}>
              Notes
            </Link>
            <Link to="/profile" className="hover:underline" activeProps={{ className: "underline" }}>
              Profile
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {user.imageUrl ? (
              <img src={user.imageUrl} alt="" className="size-7 rounded-full object-cover" />
            ) : (
              <span className="bg-muted grid size-7 place-items-center rounded-full text-xs">
                {user.name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="text-muted-foreground text-sm">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
