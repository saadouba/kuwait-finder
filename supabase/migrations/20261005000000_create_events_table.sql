create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date,
  location text,
  description text,
  category text,
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists events_date_idx on public.events (date);
create index if not exists events_category_idx on public.events (category);

alter table public.events enable row level security;

-- The app reads curated events only from its server-side service-role client.
-- No anonymous or authenticated client policies are intentionally added.
grant all on table public.events to service_role;
