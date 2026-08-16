-- ============================================================
-- blitz — community milestone schema
-- Run this whole file once in: Supabase dashboard → SQL Editor → New query
-- Safe to re-run (everything is idempotent).
-- ============================================================

-- ---------- profiles: one row per signed-in user ----------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
drop policy if exists "profiles are public" on profiles;
create policy "profiles are public" on profiles for select using (true);
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- auto-create a profile on first sign-in (handle derived from email)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  n int := 0;
begin
  base_handle := regexp_replace(lower(split_part(coalesce(new.email, 'creator'), '@', 1)), '[^a-z0-9_]', '', 'g');
  if base_handle = '' then base_handle := 'creator'; end if;
  final_handle := base_handle;
  while exists (select 1 from profiles where handle = final_handle) loop
    n := n + 1;
    final_handle := base_handle || n::text;
  end loop;

  insert into profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    final_handle,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', final_handle),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- backfill profiles for anyone who already signed in
insert into profiles (id, handle, display_name)
select u.id,
       regexp_replace(lower(split_part(coalesce(u.email, 'creator'), '@', 1)), '[^a-z0-9_]', '', 'g') || substr(u.id::text, 1, 4),
       coalesce(u.raw_user_meta_data->>'full_name', 'Creator')
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

-- ---------- looks: published recipes ----------
create table if not exists looks (
  id uuid primary key default gen_random_uuid(),
  owner uuid references profiles(id) on delete cascade,   -- null = house look
  author_handle text not null default 'blitz',
  name text not null,
  slug text unique not null,
  description text not null,
  tags text[] default '{}',
  recipe jsonb not null,
  forked_from uuid references looks(id) on delete set null,
  likes int not null default 0,
  downloads int not null default 0,
  house boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists looks_created_idx on looks (created_at desc);
create index if not exists looks_likes_idx on looks (likes desc);

alter table looks enable row level security;
drop policy if exists "looks are public" on looks;
create policy "looks are public" on looks for select using (true);
drop policy if exists "publish own looks" on looks;
create policy "publish own looks" on looks for insert with check (auth.uid() = owner);
drop policy if exists "edit own looks" on looks;
create policy "edit own looks" on looks for update using (auth.uid() = owner);
drop policy if exists "delete own looks" on looks;
create policy "delete own looks" on looks for delete using (auth.uid() = owner);

-- ---------- likes ----------
create table if not exists likes (
  user_id uuid references profiles(id) on delete cascade,
  look_id uuid references looks(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, look_id)
);

alter table likes enable row level security;
drop policy if exists "read own likes" on likes;
create policy "read own likes" on likes for select using (auth.uid() = user_id);

-- like / unlike keep the denormalized count correct atomically
create or replace function like_look(target uuid)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;
  insert into likes (user_id, look_id) values (auth.uid(), target) on conflict do nothing;
  if found then update looks set likes = likes + 1 where id = target; end if;
  select likes into c from looks where id = target;
  return c;
end; $$;

create or replace function unlike_look(target uuid)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;
  delete from likes where user_id = auth.uid() and look_id = target;
  if found then update looks set likes = greatest(0, likes - 1) where id = target; end if;
  select likes into c from looks where id = target;
  return c;
end; $$;

create or replace function increment_look_downloads(target uuid)
returns int language sql security definer set search_path = public as $$
  update looks set downloads = downloads + 1 where id = target returning downloads;
$$;

grant execute on function like_look(uuid) to authenticated;
grant execute on function unlike_look(uuid) to authenticated;
grant execute on function increment_look_downloads(uuid) to anon, authenticated;

-- ---------- seed the 12 house looks ----------
insert into looks (name, slug, description, tags, recipe, house, author_handle)
select v.name, v.slug, v.description, v.tags, v.recipe, true, 'blitz'
from (values
  ('Teal & Orange', 'teal-orange', 'The blockbuster staple — cool shadows, warm highlights. Works on almost any daylight footage.', '{"cinematic","blockbuster","popular"}', '{"v":1,"base":{"type":"look","ops":{"contrast":0.18,"sat":1.12,"splitA":[-0.012,0.012],"splitB":[-0.045,0.045]}},"trims":null}'::jsonb),
  ('Golden Hour', 'golden-hour', 'Warm, lifted and soft, like the last hour of sun. Flattering on skin and landscapes alike.', '{"warm","portrait","landscape"}', '{"v":1,"base":{"type":"look","ops":{"lift":0.03,"contrast":0.06,"sat":1.08,"warm":0.045,"splitB":[0.01,0.035],"splitA":[0.006,0.01]}},"trims":null}'::jsonb),
  ('Print Film 2383', 'print-film-2383', 'Emulates a classic print film stock: deep contrast, restrained saturation, subtle warm bias.', '{"film-emulation","cinematic"}', '{"v":1,"base":{"type":"look","ops":{"contrast":0.22,"sat":1.05,"gainDown":0.04,"splitA":[-0.006,0.004],"splitB":[-0.02,0.018],"warm":0.008}},"trims":null}'::jsonb),
  ('Noir', 'noir', 'High-contrast black and white with crushed shadows. Built for drama and hard light.', '{"black-and-white","high-contrast","dramatic"}', '{"v":1,"base":{"type":"look","ops":{"mono":true,"contrast":0.32,"lift":-0.01}},"trims":null}'::jsonb),
  ('Bleach Bypass', 'bleach-bypass', 'Desaturated and harsh — the silver-retention look used for gritty war and thriller footage.', '{"gritty","desaturated","film-emulation"}', '{"v":1,"base":{"type":"look","ops":{"mono":true,"monoKeep":0.45,"contrast":0.3,"gainDown":0.03}},"trims":null}'::jsonb),
  ('Pastel Air', 'pastel-air', 'Lifted blacks and gentle desaturation for an airy, editorial feel.', '{"soft","editorial","bright"}', '{"v":1,"base":{"type":"look","ops":{"lift":0.09,"contrast":-0.12,"sat":0.82,"warm":0.012,"tint":0.008}},"trims":null}'::jsonb),
  ('Cyber Neon', 'cyber-neon', 'Punchy saturation with magenta shadows and cyan highlights for night and neon scenes.', '{"night","neon","vibrant"}', '{"v":1,"base":{"type":"look","ops":{"contrast":0.2,"sat":1.3,"splitA":[0.02,-0.008],"splitB":[-0.05,-0.012],"gainDown":0.02}},"trims":null}'::jsonb),
  ('Moody Forest', 'moody-forest', 'Cool green shadows and pulled highlights — made for overcast, wooded, and northern light.', '{"moody","nature","cool"}', '{"v":1,"base":{"type":"look","ops":{"contrast":0.1,"sat":0.9,"gainDown":0.05,"splitA":[-0.022,-0.006],"splitB":[0.004,0.014]}},"trims":null}'::jsonb),
  ('Vintage Fade', 'vintage-fade', 'Faded blacks and warm cast, like a print left in the sun. Nostalgic without being heavy.', '{"vintage","faded","warm"}', '{"v":1,"base":{"type":"look","ops":{"lift":0.11,"contrast":-0.06,"sat":0.88,"warm":0.02,"splitB":[0.016,0.008]}},"trims":null}'::jsonb),
  ('Cream Portrait', 'cream-portrait', 'Soft warm skin tones with a light lift. A safe, flattering base for portraits.', '{"portrait","skin-tones","wedding"}', '{"v":1,"base":{"type":"look","ops":{"lift":0.05,"contrast":0.04,"sat":0.95,"warm":0.018,"tint":0.012}},"trims":null}'::jsonb),
  ('Arctic Blue', 'arctic-blue', 'Cool and clean with blue-leaning shadows. Suits snow, water, and architecture.', '{"cool","landscape","clean"}', '{"v":1,"base":{"type":"look","ops":{"contrast":0.12,"sat":0.96,"warm":-0.035,"splitA":[-0.008,0],"splitB":[-0.03,-0.01]}},"trims":null}'::jsonb),
  ('Sepia Dust', 'sepia-dust', 'Nearly monochrome with a dusty warm tone — archival, timeless, restrained.', '{"vintage","monochrome","archival"}', '{"v":1,"base":{"type":"look","ops":{"mono":true,"monoKeep":0.15,"lift":0.07,"contrast":0.02,"warm":0.035,"tint":0.01}},"trims":null}'::jsonb)
) as v(name, slug, description, tags, recipe)
on conflict (slug) do nothing;
-- ---------- "LUTs served" counter ----------
-- (Previously this lived only in a comment in lib/counter.js, which is why it
--  was easy to miss. Setup SQL belongs here.)
create table if not exists counters (
  id text primary key,
  value bigint not null default 0
);
insert into counters (id, value) values ('luts_served', 0)
  on conflict (id) do nothing;

alter table counters enable row level security;
drop policy if exists "counters are public to read" on counters;
create policy "counters are public to read"
  on counters for select using (true);

-- No insert/update policy on the table: the ONLY write path is this +1 RPC,
-- so nobody can set the counter to an arbitrary number.
create or replace function increment_counter(counter_id text)
returns bigint
language sql
security definer
set search_path = public
as $$
  update counters set value = value + 1
  where id = counter_id
  returning value;
$$;

grant execute on function increment_counter(text) to anon, authenticated;

-- ---------- feedback (fallback store if HubSpot is unreachable) ----------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  rating int not null check (rating between 1 and 5),
  name text,
  email text,
  message text,
  page text,
  created_at timestamptz default now()
);
alter table feedback enable row level security;
drop policy if exists "anyone can submit feedback" on feedback;
create policy "anyone can submit feedback"
  on feedback for insert with check (true);
-- deliberately no select policy: the public can write, never read others' feedback
