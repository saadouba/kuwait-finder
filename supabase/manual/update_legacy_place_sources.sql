-- MANUAL ONLY: review and run this file yourself after confirming the matched rows.
-- This script is intentionally stored outside supabase/migrations/ and is not applied by the app.
-- The current places schema has no separate address column; `location` is the displayed address.
-- It updates at most one source_url-null legacy row per venue, matched by name or title.
-- It does not change descriptions, categories, sample status, or claim that a venue is open.
-- OpenStreetMap-derived map data: © OpenStreetMap contributors, ODbL 1.0.
--
-- Verified address/source notes:
--   The Avenues: official address page; coordinates are the OSM mall feature centroid.
--   Souq Sharq: OSM address/map feature; source_url is a Kuwait Times report noting the
--     tenant-vacate deadline of 2026-01-31 and uncertainty about reopening.
--   Green Island: Apple Maps address; coordinates are the OSM park feature centroid.
--   Grand Mosque: IRCICA listing supplies the address context and DMS coordinates,
--     converted below to decimal degrees.

begin;

with venue_updates (
  venue_key, name_aliases, address, latitude, longitude, source_url, location_url
) as (
  values
    (
      'the avenues',
      array['the avenues', 'the avenues mall']::text[],
      'Al-Rai, 5th Ring Road, between Ghazali Street and Mohammed Bin Alqasem Street, Kuwait',
      29.3035362::double precision,
      47.9390844::double precision,
      'https://www.the-avenues.com/kuwait/en/map',
      'https://www.openstreetmap.org/way/164140967'
    ),
    (
      'souq sharq',
      array['souq sharq', 'souk sharq']::text[],
      '2, Arabian Gulf Street, Sharq, Kuwait City, Kuwait',
      29.3891370::double precision,
      47.9809055::double precision,
      'https://kuwaittimes.com/article/38795/lifestyle/art-fashion/end-of-an-era-memories-remain-as-souq-sharq-prepares-to-close/',
      'https://www.openstreetmap.org/way/378053187'
    ),
    (
      'green island',
      array['green island', 'green island kuwait']::text[],
      'Arabian Gulf Street, Hawalli, Kuwait',
      29.3650237::double precision,
      48.0267864::double precision,
      'https://maps.apple.com/place?place-id=I1CC0C331ABA057AE',
      'https://www.openstreetmap.org/way/169995829'
    ),
    (
      'grand mosque',
      array['grand mosque', 'the grand mosque', 'grand mosque of kuwait', 'the grand mosque of kuwait']::text[],
      '25, Kuwait City, Kuwait (Arabian Gulf Street, opposite Al-Sief Palace)',
      29.3794250::double precision,
      47.9749028::double precision,
      'https://www.islamicarchitecturalheritage.com/listings/the-grand-mosque-of-kuwait',
      'https://www.openstreetmap.org/?mlat=29.3794250&mlon=47.9749028#map=18/29.3794250/47.9749028'
    )
), matched_rows as (
  select distinct on (update_row.venue_key)
    place_row.ctid as row_ctid,
    update_row.venue_key,
    update_row.address,
    update_row.latitude,
    update_row.longitude,
    update_row.source_url,
    update_row.location_url
  from public.places as place_row
  join venue_updates as update_row
    on lower(btrim(coalesce(place_row.name, ''))) = any(update_row.name_aliases)
    or lower(btrim(coalesce(place_row.title, ''))) = any(update_row.name_aliases)
  where place_row.source_url is null
  order by update_row.venue_key, place_row.ctid
)
update public.places as place_row
set
  location = matched.address,
  latitude = matched.latitude,
  longitude = matched.longitude,
  source_url = matched.source_url,
  location_url = matched.location_url
from matched_rows as matched
where place_row.ctid = matched.row_ctid
  and place_row.source_url is null
returning
  place_row.name,
  place_row.location as address,
  place_row.latitude,
  place_row.longitude,
  place_row.source_url,
  place_row.location_url;

commit;
