-- Manual cleanup for the five legacy place rows that duplicate newer curated entries.
-- This deletes at most one row for each listed name and only when source_url IS NULL.
-- Review the RETURNING output after running this file yourself; this file is not applied by the app.

with matched_legacy_rows as (
  select
    ctid,
    lower(btrim(name)) as matched_name
  from public.places
  where source_url is null
    and lower(btrim(name)) in (
      'the avenues',
      'kuwait towers',
      'souq sharq',
      'green island',
      'grand mosque'
    )
), one_row_per_name as (
  select distinct on (matched_name) ctid
  from matched_legacy_rows
  order by matched_name, ctid
)
delete from public.places as place
using one_row_per_name as legacy
where place.ctid = legacy.ctid
returning place.name as deleted_name;
