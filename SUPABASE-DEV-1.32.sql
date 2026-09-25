-- QuizTown DEV 1.32 online-room repair
-- Supabase SQL Editor에서 한 번 실행하세요.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  channel integer not null default 1,
  title text not null,
  mode text not null default 'normal',
  difficulty integer not null default 2,
  max_players integer not null default 10,
  status text not null default 'waiting',
  host_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  ready boolean not null default false,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id,user_id)
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select to authenticated using (true);
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms for insert to authenticated with check (host_id=auth.uid());
drop policy if exists rooms_update_host on public.rooms;
create policy rooms_update_host on public.rooms for update to authenticated using (host_id=auth.uid()) with check (host_id=auth.uid());
drop policy if exists rooms_delete_host on public.rooms;
create policy rooms_delete_host on public.rooms for delete to authenticated using (host_id=auth.uid());

drop policy if exists members_read on public.room_members;
create policy members_read on public.room_members for select to authenticated using (true);
drop policy if exists members_insert_self on public.room_members;
create policy members_insert_self on public.room_members for insert to authenticated with check (user_id=auth.uid());
drop policy if exists members_update_self on public.room_members;
create policy members_update_self on public.room_members for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists members_delete_self on public.room_members;
create policy members_delete_self on public.room_members for delete to authenticated using (user_id=auth.uid());

grant select,insert,update,delete on public.rooms to authenticated;
grant select,insert,update,delete on public.room_members to authenticated;

create or replace function public.qt_create_room(p_channel integer,p_difficulty integer,p_max_players integer,p_title text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare rid uuid; nick text;
begin
  select nickname into nick from public.profiles where id=auth.uid();
  insert into public.rooms(channel,title,mode,difficulty,max_players,status,host_id)
  values(p_channel,p_title,'normal',p_difficulty,p_max_players,'waiting',auth.uid()) returning id into rid;
  insert into public.room_members(room_id,user_id,nickname,ready,score)
  values(rid,auth.uid(),coalesce(nick,'유저'),false,0);
  return rid;
end $$;

create or replace function public.qt_join_room(p_room_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare nick text; cap integer; cnt integer; st text;
begin
  select max_players,status into cap,st from public.rooms where id=p_room_id;
  if cap is null then raise exception 'room_not_found'; end if;
  if st<>'waiting' then raise exception 'room_not_waiting'; end if;
  select count(*) into cnt from public.room_members where room_id=p_room_id;
  if cnt>=cap then raise exception 'room_full'; end if;
  select nickname into nick from public.profiles where id=auth.uid();
  insert into public.room_members(room_id,user_id,nickname,ready,score)
  values(p_room_id,auth.uid(),coalesce(nick,'유저'),false,0)
  on conflict(room_id,user_id) do nothing;
end $$;

create or replace function public.qt_leave_room(p_room_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare was_host boolean; next_host uuid; remain integer;
begin
  select exists(select 1 from public.rooms where id=p_room_id and host_id=auth.uid()) into was_host;
  delete from public.room_members where room_id=p_room_id and user_id=auth.uid();
  select count(*) into remain from public.room_members where room_id=p_room_id;
  if remain=0 then delete from public.rooms where id=p_room_id;
  elsif was_host then
    select user_id into next_host from public.room_members where room_id=p_room_id order by joined_at limit 1;
    update public.rooms set host_id=next_host where id=p_room_id;
  end if;
end $$;

grant execute on function public.qt_create_room(integer,integer,integer,text) to authenticated;
grant execute on function public.qt_join_room(uuid) to authenticated;
grant execute on function public.qt_leave_room(uuid) to authenticated;

-- Realtime Postgres Changes를 쓰는 DEV 클라이언트를 위해 publication에 추가.
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null; end $$;
