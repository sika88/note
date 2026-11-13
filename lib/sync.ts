import type { LocalDB, Note } from "./local-db";

type ServerNote = Omit<Note, "dirty">;

let running: Promise<void> | null = null;
let rerun = false;

// Only one sync at a time. If something changes mid-sync, run once more afterwards.
export function syncNow(db: LocalDB): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        rerun = false;
        await syncOnce(db);
      } while (rerun);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(db: LocalDB) {
  if (!navigator.onLine) return;

  // 1. PUSH local changes
  const dirty = await db.notes.where("dirty").equals(1).toArray();
  for (let i = 0; i < dirty.length; i += 50) {
    const chunk = dirty.slice(i, i + 50);
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: chunk.map(({ dirty: _d, ...n }) => n) }),
    });
    if (!res.ok) throw new Error(`push failed: ${res.status}`);

    // Mark clean only if the note wasn't edited again while the request was in flight
    await db.transaction("rw", db.notes, async () => {
      for (const sent of chunk) {
        const current = await db.notes.get(sent.id);
        if (current && current.updatedAt === sent.updatedAt) {
          await db.notes.update(sent.id, { dirty: 0 });
        }
      }
    });
  }

  // 2. PULL server changes since our cursor
  let since = (await db.meta.get("cursor"))?.value ?? 0;
  for (;;) {
    const res = await fetch(`/api/sync?since=${since}`);
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    const data = (await res.json()) as { notes: ServerNote[]; cursor: number; hasMore: boolean };

    await db.transaction("rw", db.notes, db.meta, async () => {
      for (const server of data.notes) {
        const local = await db.notes.get(server.id);
        // keep a newer unsynced local edit; otherwise the server version wins
        if (local?.dirty && local.updatedAt > server.updatedAt) continue;
        await db.notes.put({ ...server, dirty: 0 });
      }
      await db.meta.put({ key: "cursor", value: data.cursor });
    });

    since = data.cursor;
    if (!data.hasMore) break;
  }
}
