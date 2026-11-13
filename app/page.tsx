import { auth, signIn, signOut } from "@/auth";
import NotesApp from "./notes-app";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl font-bold text-white">
            N
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Offline Notes</h1>
          <p className="mt-1 text-sm text-muted">Write anywhere. Sync when you can.</p>
          <form
            className="mt-6"
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
              Continue with Google
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <NotesApp
      userId={session.user.id}
      userName={session.user.name ?? session.user.email ?? "You"}
      signOutAction={async () => {
        "use server";
        await signOut();
      }}
    />
  );
}
