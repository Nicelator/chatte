-- Run this in your Supabase SQL editor

create table if not exists waiting_users (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  gender text not null,
  wants text not null default 'any',
  joined_at timestamptz default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  user_a text not null,
  user_b text not null,
  created_at timestamptz default now()
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  from_user text not null,
  to_user text not null,
  type text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index on waiting_users(wants, joined_at);
create index on signals(room_id, to_user, created_at);

alter publication supabase_realtime add table signals;
alter publication supabase_realtime add table rooms;

alter table waiting_users enable row level security;
alter table rooms enable row level security;
alter table signals enable row level security;

create policy "public insert waiting" on waiting_users for insert with check (true);
create policy "public select waiting" on waiting_users for select using (true);
create policy "public delete waiting" on waiting_users for delete using (true);

create policy "public insert rooms" on rooms for insert with check (true);
create policy "public select rooms" on rooms for select using (true);
create policy "public delete rooms" on rooms for delete using (true);

create policy "public insert signals" on signals for insert with check (true);
create policy "public select signals" on signals for select using (true);
create policy "public delete signals" on signals for delete using (true);
