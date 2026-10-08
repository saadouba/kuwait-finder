begin;

-- Rich, source-backed event details for search and curated event cards.
alter table public.events add column if not exists date_start date;
alter table public.events add column if not exists date_end date;
alter table public.events add column if not exists time text;
alter table public.events add column if not exists venue text;
alter table public.events add column if not exists address text;
alter table public.events add column if not exists price text;
alter table public.events add column if not exists long_description text;

-- Preserve legacy single-date entries while the new start/end fields are adopted.
update public.events
set date_start = date
where date_start is null and date is not null;

update public.events
set date_end = date
where date_end is null and date is not null;

create index if not exists events_date_start_idx on public.events (date_start);

-- Directory metadata used by expandable place, restaurant, and activity cards.
alter table public.places add column if not exists long_description text;
alter table public.places add column if not exists time text;
alter table public.places add column if not exists venue text;
alter table public.places add column if not exists address text;
alter table public.places add column if not exists price text;

commit;
