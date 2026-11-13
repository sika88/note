"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getLocalDb, type Note } from "@/lib/local-db";
import { syncNow } from "@/lib/sync";

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function NotesApp({
  userId,
  userName,
  signOutAction,
}: {
  userId: string;
  userName: string;
  signOutAction: () => Promise<void>;
}) {
  const db = useMemo(() => getLocalDb(userId), [userId]);
  const online = useOnline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);

  // The UI reads ONLY from the local database and re-renders when it changes
  const notes = useLiveQuery(
    () => db.notes.orderBy("updatedAt").reverse().filter((n) => !n.deleted).toArray(),
    [db],
    undefined,
  );
  const pending = useLiveQuery(() => db.notes.where("dirty").equals(1).count(), [db], 0);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncNow(db);
      setSyncError(false);
    } catch {
      setSyncError(true);
    } finally {
      setSyncing(false);
    }
  }, [db]);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleSync = useCallback(() => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(runSync, 1500);
  }, [runSync]);

  useEffect(() => {
    runSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") runSync();
    };
    window.addEventListener("online", runSync);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(runSync, 30_000);
    return () => {
      window.removeEventListener("online", runSync);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
      clearTimeout(syncTimer.current);
    };
  }, [runSync]);

  async function createNote() {
    const id = crypto.randomUUID();
    await db.notes.add({ id, title: "", body: "", deleted: false, updatedAt: Date.now(), dirty: 1 });
    setSelectedId(id);
    scheduleSync();
  }

  const saveNote = useCallback(
    async (id: string, title: string, body: string) => {
      await db.notes.update(id, { title, body, updatedAt: Date.now(), dirty: 1 });
      scheduleSync();
    },
    [db, scheduleSync],
  );

  async function deleteNote(id: string) {
    await db.notes.update(id, { deleted: true, updatedAt: Date.now(), dirty: 1 });
    setSelectedId(null);
    scheduleSync();
  }

  const selected = notes?.find((n) => n.id === selectedId) ?? null;

  const status = !online
    ? "Offline"
    : syncError
      ? "Sync failed, will retry"
      : syncing
        ? "Syncing…"
        : pending > 0
          ? `${pending} waiting to sync`
          : "All synced";
  const dot = !online ? "bg-amber-500" : syncError ? "bg-red-500" : pending > 0 || syncing ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">N</div>
        <span className="font-semibold tracking-tight">Notes</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            {status}
          </span>
          <button
            onClick={runSync}
            disabled={!online || syncing}
            className="rounded-md border border-border px-2.5 py-1 text-xs transition hover:border-accent disabled:opacity-40"
          >
            Sync
          </button>
          <form action={signOutAction}>
            <button className="text-muted transition hover:text-foreground" title={userName}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`${selected ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border bg-surface md:w-80`}>
          <div className="p-3">
            <button
              onClick={createNote}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              + New note
            </button>
          </div>
          <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
            {notes === undefined && <li className="p-3 text-sm text-muted">Loading…</li>}
            {notes?.length === 0 && (
              <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
                No notes yet. Create one. It works offline too.
              </li>
            )}
            {notes?.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setSelectedId(n.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    n.id === selectedId ? "border-accent bg-accent/10" : "border-transparent hover:bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{n.title || "Untitled"}</span>
                    {n.dirty === 1 && <span title="Not synced yet" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{n.body || "No content"}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {new Date(n.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {selected ? (
            <Editor
              key={selected.id}
              note={selected}
              onSave={saveNote}
              onDelete={() => {
                if (window.confirm("Delete this note?")) deleteNote(selected.id);
              }}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="m-auto text-sm text-muted">Select a note or create a new one</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Editor({
  note,
  onSave,
  onDelete,
  onBack,
}: {
  note: Note;
  onSave: (id: string, title: string, body: string) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ title: string; body: string } | null>(null);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) {
      const { title, body } = pending.current;
      pending.current = null;
      onSave(note.id, title, body);
    }
  }, [note.id, onSave]);

  // Save any pending edit when leaving the note, so nothing typed is lost
  useEffect(() => flush, [flush]);

  function change(nextTitle: string, nextBody: string) {
    setTitle(nextTitle);
    setBody(nextBody);
    pending.current = { title: nextTitle, body: nextBody };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-muted transition hover:text-foreground md:hidden">
          ← Notes
        </button>
        <button onClick={onDelete} className="ml-auto text-sm text-muted transition hover:text-red-500">
          Delete
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => change(e.target.value, body)}
        placeholder="Title"
        maxLength={200}
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted"
      />
      <textarea
        value={body}
        onChange={(e) => change(title, e.target.value)}
        placeholder="Start writing…"
        maxLength={20000}
        className="mt-3 min-h-0 w-full flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted"
      />
    </div>
  );
}
