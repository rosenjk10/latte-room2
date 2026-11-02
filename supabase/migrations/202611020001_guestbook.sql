-- LATTE ROOM shared guestbook. Apply once in the Supabase SQL editor.
-- Existing cafe_rooms and room_presence are not modified.
begin;
create schema if not exists latte_private;
revoke all on schema latte_private from public, anon, authenticated;
create table public.cafe_guestbook (
 id uuid primary key default gen_random_uuid(),
 nickname text not null check (char_length(nickname) between 1 and 16),
 message text not null check (char_length(message) between 1 and 100),
 created_at timestamptz not null default now()
);
create index cafe_guestbook_latest on public.cafe_guestbook(created_at desc,id);
create table latte_private.guestbook_rate (
 author_id uuid not null,
 created_at timestamptz not null default now(),
 message_hash text not null
);
create index guestbook_rate_author_time on latte_private.guestbook_rate(author_id,created_at desc);
create index guestbook_rate_time on latte_private.guestbook_rate(created_at desc);
revoke all on public.cafe_guestbook from public, anon, authenticated;
revoke all on latte_private.guestbook_rate from public, anon, authenticated;
alter table public.cafe_guestbook enable row level security;
create policy "guestbook_public_read" on public.cafe_guestbook for select to anon, authenticated using (true);
grant select on public.cafe_guestbook to anon, authenticated;

create or replace function public.post_cafe_guestbook(p_nickname text,p_message text)
returns public.cafe_guestbook
language plpgsql security definer set search_path = ''
as $$
declare
 visitor uuid := auth.uid();
 n text := btrim(p_nickname);
 m text := btrim(p_message);
 result public.cafe_guestbook;
begin
 if visitor is null then raise exception '로그인 화면 없이 익명 인증을 먼저 완료해주세요.' using errcode='28000'; end if;
 if n is null or m is null or char_length(n) not between 1 and 16 or char_length(m) not between 1 and 100 then
  raise exception '닉네임 1~16자, 메시지 1~100자를 입력해주세요.' using errcode='22023';
 end if;
 if (n || m) ~ '[[:cntrl:]]' or (n || ' ' || m) ~* '(https?://|www\.|씨발|시발|병신|개새끼|fuck|shit)' or m ~ '(.)\1{5,}' then
  raise exception '링크, 비속어 또는 반복 문자는 사용할 수 없어요.' using errcode='22023';
 end if;
 -- One lock serializes the check+write, so concurrent RPC calls cannot bypass limits.
 perform pg_catalog.pg_advisory_xact_lock(742019502);
 delete from latte_private.guestbook_rate where created_at < now()-interval '24 hours';
 if exists(select 1 from latte_private.guestbook_rate where author_id=visitor and created_at>now()-interval '60 seconds') then
  raise exception '메모는 1분에 한 번 남길 수 있어요.' using errcode='P0001';
 end if;
 if (select count(*) from latte_private.guestbook_rate where author_id=visitor and created_at>now()-interval '1 hour')>=5 then
  raise exception '한 시간에 다섯 번까지 남길 수 있어요.' using errcode='P0001';
 end if;
 -- Bounds writes even if a visitor rotates anonymous accounts. Tune deliberately.
 if (select count(*) from latte_private.guestbook_rate where created_at>now()-interval '1 hour')>=100 then
  raise exception '카페 전체 메모가 잠시 가득 찼어요. 나중에 다시 와주세요.' using errcode='P0001';
 end if;
 if exists(select 1 from latte_private.guestbook_rate where author_id=visitor and message_hash=md5(lower(regexp_replace(m,'\s+','','g')))) then
  raise exception '같은 메모는 하루에 한 번만 남겨주세요.' using errcode='P0001';
 end if;
 insert into public.cafe_guestbook(nickname,message) values(n,m) returning * into result;
 insert into latte_private.guestbook_rate(author_id,message_hash) values(visitor,md5(lower(regexp_replace(m,'\s+','','g'))));
 return result;
end;
$$;
revoke all on function public.post_cafe_guestbook(text,text) from public, anon;
grant execute on function public.post_cafe_guestbook(text,text) to authenticated;
-- Only INSERT events are needed. RLS still applies to subscriber reads.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafe_guestbook'
 ) then alter publication supabase_realtime add table public.cafe_guestbook; end if;
end $$;
commit;
