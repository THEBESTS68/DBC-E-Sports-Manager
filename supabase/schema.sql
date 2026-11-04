-- =====================================================================
--  DBC NextGen E-Sport Manager — Supabase schema
--  รันไฟล์นี้ใน Supabase Dashboard > SQL Editor ครั้งเดียว
-- =====================================================================

-- ---------- ผู้ดูแล (กรรมการ) ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- ข้อมูลการแข่งขันของแต่ละเกม ----------
-- ef / rov: { players: text, tournament: [[{p1,p2,s1,s2,winner,loser}]] }
-- ff      : { players: text, teamsData: [{name,m1R,m1K,...,booyah,kills,pts}] }
create table if not exists public.games (
  id         text primary key check (id in ('ef', 'rov', 'ff')),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.games (id) values ('ef'), ('rov'), ('ff') on conflict do nothing;

-- ---------- โปรไฟล์ (ข้อมูลที่ทุกคนเห็นได้) ----------
create table if not exists public.profiles (
  id         text primary key,
  type       text not null check (type in ('player', 'team')),
  game       text not null check (game in ('ef', 'rov', 'ff')),
  name       text not null,
  team       text not null default '',
  members    text not null default '',
  avatar     text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- ข้อมูลส่วนตัว (เฉพาะกรรมการ) ----------
create table if not exists public.profile_private (
  profile_id text primary key references public.profiles (id) on delete cascade,
  realname   text not null default '',
  role       text not null default '',
  bio        text not null default ''
);

-- ---------- Row Level Security ----------
alter table public.admins          enable row level security;
alter table public.games           enable row level security;
alter table public.profiles        enable row level security;
alter table public.profile_private enable row level security;

drop policy if exists "admins read own row" on public.admins;
create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "games public read" on public.games;
create policy "games public read" on public.games
  for select to anon, authenticated using (true);
drop policy if exists "games admin write" on public.games;
create policy "games admin write" on public.games
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles
  for select to anon, authenticated using (true);
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "private admin only" on public.profile_private;
create policy "private admin only" on public.profile_private
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.games, public.profiles, public.profile_private;

-- ---------- เพิ่มกรรมการ ----------
-- 1) สร้างผู้ใช้ใน Authentication > Users (Add user > อีเมล + รหัสผ่าน)
-- 2) รันคำสั่งนี้โดยเปลี่ยนอีเมล:
-- insert into public.admins (user_id) select id from auth.users where email = 'referee@example.com';
