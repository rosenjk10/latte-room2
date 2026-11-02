import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const uid = "22222222-2222-4222-8222-222222222222";
async function asVisitor(role = "authenticated") {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${uid}',false);set role ${role}`,
  );
}
async function post(name = "손님", message = "오늘의 작은 행복") {
  return db.query("select * from public.post_cafe_guestbook($1,$2)", [
    name,
    message,
  ]);
}
describe("guestbook migration on PostgreSQL (PGlite, not hosted Supabase)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202611020001_guestbook.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }, 20000);
  beforeEach(async () => {
    await db.exec(
      "reset role;truncate public.cafe_guestbook,latte_private.guestbook_rate;",
    );
    await asVisitor();
  });
  afterAll(async () => {
    await db.close();
  });
  it("saves text and exposes latest entries for public read", async () => {
    await post("민트", "<b>오늘도 쉬어가요</b>");
    await db.exec("set role anon");
    const r = await db.query<{ nickname: string; message: string }>(
      "select nickname,message from public.cafe_guestbook",
    );
    expect(r.rows).toEqual([
      { nickname: "민트", message: "<b>오늘도 쉬어가요</b>" },
    ]);
  });
  it("blocks direct writes, deletes, rate-log access and unauthenticated RPC", async () => {
    await expect(
      db.exec(
        "insert into public.cafe_guestbook(nickname,message) values('a','b')",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("delete from public.cafe_guestbook")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.exec("select * from latte_private.guestbook_rate"),
    ).rejects.toThrow(/permission denied/);
    await asVisitor("anon");
    await expect(post()).rejects.toThrow(/permission denied/);
  });
  it("rejects missing auth identity even when RPC permission is present", async () => {
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
    await expect(post()).rejects.toThrow(/익명 인증/);
  });
  it("validates length, links, profanity and repeated characters on the server", async () => {
    for (const [n, m] of [
      ["", "hello"],
      ["a", "가".repeat(101)],
      ["a", "https://example.com"],
      ["a", "시발"],
      ["a", "aaaaaa"],
    ])
      await expect(post(n, m)).rejects.toThrow();
    const r = await db.query<{ n: number }>(
      "select count(*)::int n from public.cafe_guestbook",
    );
    expect(r.rows[0].n).toBe(0);
  });
  it("enforces one write per sixty seconds", async () => {
    await post();
    await expect(post("손님", "다른 글")).rejects.toThrow(/1분/);
  });
  it("enforces hourly per-user limit even after the minute window", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into latte_private.guestbook_rate select $1::uuid,now()-interval '2 minutes',g::text from generate_series(1,5) g",
      [uid],
    );
    await asVisitor();
    await expect(post()).rejects.toThrow(/한 시간/);
  });
  it("enforces a global ceiling despite anonymous account rotation", async () => {
    await db.exec(
      "reset role;insert into latte_private.guestbook_rate select gen_random_uuid(),now()-interval '2 minutes',g::text from generate_series(1,100) g;",
    );
    await asVisitor();
    await expect(post()).rejects.toThrow(/카페 전체/);
  });
  it("rejects duplicate text after the cooldown", async () => {
    await post();
    await db.exec(
      "reset role;update latte_private.guestbook_rate set created_at=now()-interval '2 minutes'",
    );
    await asVisitor();
    await expect(post()).rejects.toThrow(/같은 메모/);
  });
});
