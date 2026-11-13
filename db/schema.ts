import {
  pgTable, pgSequence, text, timestamp, integer, bigint, boolean, uuid, primaryKey, index,
} from "drizzle-orm/pg-core";

// ---- Auth.js tables ----
export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

// ---- Notes ----
// Every write bumps `seq`. Clients pull "everything after the last seq I saw".
export const noteSeq = pgSequence("note_seq");

export const notes = pgTable("note", {
  id: uuid("id").primaryKey(), // generated on the client
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  deleted: boolean("deleted").notNull().default(false), // soft delete so deletions can sync
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(), // client clock (ms), used to resolve conflicts
  seq: bigint("seq", { mode: "number" }).notNull(), // server order, used as the pull cursor
}, (t) => [index("note_user_seq_idx").on(t.userId, t.seq)]);
