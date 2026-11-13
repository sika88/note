import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { notes } from "@/db/schema";

export const dynamic = "force-dynamic";

const change = z.object({
  id: z.string().uuid(),
  title: z.string().max(200),
  body: z.string().max(20000),
  updatedAt: z.number().int().positive(),
  deleted: z.boolean(),
});
const pushBody = z.object({ changes: z.array(change).max(50) });

// PUSH: client sends its dirty notes
export async function POST(req: Request) {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = pushBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { changes } = parsed.data;

  if (changes.length > 0) {
    const maxClock = Date.now() + 60_000; // a wrong device clock must not win forever
    const stmts = changes.map((c) => {
      const updatedAt = Math.min(c.updatedAt, maxClock);
      return db
        .insert(notes)
        .values({
          id: c.id,
          userId: uid,
          title: c.title,
          body: c.body,
          deleted: c.deleted,
          updatedAt,
          seq: sql`nextval('note_seq')`,
        })
        .onConflictDoUpdate({
          target: notes.id,
          set: {
            title: c.title,
            body: c.body,
            deleted: c.deleted,
            updatedAt,
            seq: sql`nextval('note_seq')`,
          },
          // last-write-wins, and only ever touch the caller's own rows
          setWhere: and(eq(notes.userId, uid), lt(notes.updatedAt, updatedAt)),
        });
    });
    type Stmt = (typeof stmts)[number];
    await db.batch(stmts as [Stmt, ...Stmt[]]);
  }

  return NextResponse.json({ ok: true });
}

// PULL: client asks for everything after its cursor
export async function GET(req: Request) {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = Number(new URL(req.url).searchParams.get("since") ?? 0);
  if (!Number.isFinite(since) || since < 0) {
    return NextResponse.json({ error: "Bad cursor" }, { status: 400 });
  }

  const LIMIT = 200;
  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, uid), gt(notes.seq, since)))
    .orderBy(asc(notes.seq))
    .limit(LIMIT + 1);

  const hasMore = rows.length > LIMIT;
  const page = hasMore ? rows.slice(0, LIMIT) : rows;
  const cursor = page.at(-1)?.seq ?? since;

  return NextResponse.json({
    notes: page.map(({ userId: _u, seq: _s, ...n }) => n),
    cursor,
    hasMore,
  });
}
