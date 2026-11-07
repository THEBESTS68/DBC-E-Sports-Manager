-- =====================================================================
--  002 — ระบบลงทะเบียนนักกีฬา และสมัครเป็นกรรมการ
--  รันใน Supabase SQL Editor หลัง schema.sql (รันซ้ำได้)
-- =====================================================================

-- ---------- คำขอลงทะเบียนนักกีฬา / ทีม ----------
-- ใครก็ส่งได้ (ไม่ต้องล็อกอิน) แต่อ่าน/อนุมัติได้เฉพาะกรรมการ
create table if not exists public.registrations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('player', 'team')),
  game        text not null check (game in ('ef', 'rov', 'ff')),
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  realname    text not null default '' check (char_length(realname) <= 80),
  student_id  text not null default '' check (char_length(student_id) <= 20),
  team        text not null default '' check (char_length(team) <= 40),
  role        text not null default '' check (char_length(role) <= 40),
  members     text not null default '' check (char_length(members) <= 1000),
  contact     text not null default '' check (char_length(contact) <= 100),
  avatar      text not null default '' check (char_length(avatar) <= 500),
  bio         text not null default '' check (char_length(bio) <= 1000),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  profile_id  text references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists registrations_status_idx on public.registrations (status, created_at desc);

alter table public.registrations enable row level security;

drop policy if exists "anyone can register" on public.registrations;
create policy "anyone can register" on public.registrations
  for insert to anon, authenticated
  with check (status = 'pending' and profile_id is null and reviewed_at is null);

drop policy if exists "admins manage registrations" on public.registrations;
create policy "admins manage registrations" on public.registrations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- คำขอเป็นกรรมการ ----------
-- สร้างอัตโนมัติเมื่อมีคนสมัครบัญชี (trigger ด้านล่าง) รอกรรมการที่มีอยู่อนุมัติ
create table if not exists public.admin_requests (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email        text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

alter table public.admin_requests enable row level security;

drop policy if exists "see own or admin" on public.admin_requests;
create policy "see own or admin" on public.admin_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins update requests" on public.admin_requests;
create policy "admins update requests" on public.admin_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.admin_requests (user_id, display_name, email)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- อนุมัติ (ทำในฐานข้อมูล ทีเดียวจบ) ----------
create or replace function public.approve_registration(reg_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  r   public.registrations;
  pid text;
begin
  if not public.is_admin() then raise exception 'ต้องเป็นกรรมการ'; end if;
  select * into r from public.registrations where id = reg_id for update;
  if not found or r.status <> 'pending' then raise exception 'คำขอนี้ไม่ได้รออนุมัติแล้ว'; end if;
  if exists (select 1 from public.profiles p
             where p.type = r.kind and p.game = r.game and lower(btrim(p.name)) = lower(btrim(r.name))) then
    raise exception 'มีโปรไฟล์ชื่อ "%" ในเกมนี้แล้ว', r.name;
  end if;
  pid := (case when r.kind = 'team' then 't_' else 'p_' end) || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  insert into public.profiles (id, type, game, name, team, members, avatar)
    values (pid, r.kind, r.game, btrim(r.name), r.team, r.members, r.avatar);
  insert into public.profile_private (profile_id, realname, role, bio)
    values (pid, r.realname, r.role, r.bio);
  update public.registrations set status = 'approved', profile_id = pid, reviewed_at = now() where id = reg_id;
  return pid;
end;
$$;

create or replace function public.review_admin_request(req_user uuid, approve boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'ต้องเป็นกรรมการ'; end if;
  update public.admin_requests
     set status = case when approve then 'approved' else 'rejected' end, reviewed_at = now()
   where user_id = req_user and status = 'pending';
  if not found then raise exception 'คำขอนี้ไม่ได้รออนุมัติแล้ว'; end if;
  if approve then
    insert into public.admins (user_id) values (req_user) on conflict do nothing;
  end if;
end;
$$;

revoke execute on function public.approve_registration(uuid) from anon;
revoke execute on function public.review_admin_request(uuid, boolean) from anon;

-- ---------- Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'registrations') then
    alter publication supabase_realtime add table public.registrations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'admin_requests') then
    alter publication supabase_realtime add table public.admin_requests;
  end if;
end $$;
