begin;

-- Curated events remain separate from web-discovered items. Coordinates are optional
-- when a venue is not known; sample rows are never treated as verified events.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text not null,
  date date,
  location text,
  description text,
  category text not null default 'Events',
  source_url text,
  latitude double precision,
  longitude double precision,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.events add column if not exists slug text;
alter table public.events add column if not exists latitude double precision;
alter table public.events add column if not exists longitude double precision;
alter table public.events add column if not exists is_sample boolean not null default false;
update public.events set category = 'Events' where category is null or category <> 'Events';
alter table public.events alter column category set default 'Events';

create index if not exists events_date_idx on public.events (date);
create index if not exists events_category_idx on public.events (category);
create unique index if not exists events_slug_unique_idx on public.events (slug) where slug is not null;
alter table public.events enable row level security;
grant all on table public.events to service_role;

-- Create the directory table when the project has not created one yet, and add
-- only the columns needed by this app when an older places table already exists.
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  slug text,
  name text not null,
  title text,
  description text not null default '',
  category text not null default 'Places',
  location text not null default 'Kuwait',
  latitude double precision,
  longitude double precision,
  source_url text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.places add column if not exists slug text;
alter table public.places add column if not exists name text;
alter table public.places add column if not exists title text;
alter table public.places add column if not exists description text;
alter table public.places add column if not exists category text not null default 'Places';
alter table public.places add column if not exists location text;
alter table public.places add column if not exists latitude double precision;
alter table public.places add column if not exists longitude double precision;
alter table public.places add column if not exists source_url text;
alter table public.places add column if not exists location_url text;
alter table public.places add column if not exists is_sample boolean not null default false;
update public.places set category = 'Places' where category is null or btrim(category) = '';
update public.places set location = 'Kuwait' where location is null or btrim(location) = '';
update public.places set is_sample = false where is_sample is null;
create index if not exists places_category_idx on public.places (category);
create unique index if not exists places_slug_unique_idx on public.places (slug) where slug is not null;
alter table public.places enable row level security;
grant all on table public.places to service_role;

-- Supabase-backed cache makes answer reuse survive Vercel serverless instances.
-- The cache key is a SHA-256 digest; raw search questions are not stored here.
create table if not exists public.search_answer_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists search_answer_cache_expires_idx on public.search_answer_cache (expires_at);
alter table public.search_answer_cache enable row level security;
grant all on table public.search_answer_cache to service_role;

-- Fixed one-minute windows; only a keyed HMAC of the client address is stored.
create table if not exists public.api_rate_limits (
  client_hash text not null,
  bucket_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (client_hash, bucket_start)
);
create index if not exists api_rate_limits_expires_idx on public.api_rate_limits (expires_at);
alter table public.api_rate_limits enable row level security;
grant all on table public.api_rate_limits to service_role;

create or replace function public.consume_search_rate_limit(
  p_client_hash text,
  p_bucket_start timestamptz,
  p_limit integer
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
begin
  if p_client_hash is null or length(p_client_hash) <> 64 or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid rate-limit request';
  end if;

  insert into public.api_rate_limits (client_hash, bucket_start, request_count, expires_at)
  values (p_client_hash, p_bucket_start, 1, p_bucket_start + interval '10 minutes')
  on conflict (client_hash, bucket_start) do update
    set request_count = case
      when public.api_rate_limits.request_count < p_limit then public.api_rate_limits.request_count + 1
      else public.api_rate_limits.request_count
    end,
    expires_at = excluded.expires_at
  returning request_count into current_count;

  delete from public.api_rate_limits where expires_at < now();
  return current_count;
end;
$$;
revoke all on function public.consume_search_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_search_rate_limit(text, timestamptz, integer) to service_role;

commit;
