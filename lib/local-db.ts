import Dexie, { type Table } from "dexie";

export type Note = {
  id: string;
  title: string;
  body: string;
  deleted: boolean;
  updatedAt: number;
  dirty: 0 | 1; // 1 = has local changes not yet pushed
};

export class LocalDB extends Dexie {
  notes!: Table<Note, string>;
  meta!: Table<{ key: string; value: number }, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      notes: "id, updatedAt, dirty",
      meta: "key",
    });
  }
}

// One database per user, so two accounts on one browser never see each other's notes
const cache = new Map<string, LocalDB>();
export function getLocalDb(userId: string) {
  let db = cache.get(userId);
  if (!db) {
    db = new LocalDB(`notes-${userId}`);
    cache.set(userId, db);
  }
  return db;
}
