-- Kuwait Finder example directory seed.
-- Apply both migrations first. This file is optional and safe to re-run.
-- Real venue rows use source_url for venue information and location_url for the
-- independently checked map feature or geocoding destination.
-- Magic Planet uses the OpenStreetMap centroid of The Avenues Mall, not an exact
-- tenant entrance; its location and description explicitly say it is mall-level.
-- The five event rows below are fictional UI examples, not real announcements.
-- They are marked is_sample=true, have date=NULL, source_url=NULL, and explain
-- that their coordinates are real venue anchors rather than event locations.

begin;

insert into public.places (
  slug, name, title, description, category, location, latitude, longitude,
  source_url, location_url, is_sample
) values
  (
    'kuwait-towers', 'Kuwait Towers', 'Kuwait Towers',
    'A well-known Kuwait City landmark and visitor attraction on Arabian Gulf Road in Sharq district.',
    'Places', 'Arabian Gulf Road, Sharq district, Kuwait City, Kuwait',
    29.3899212, 48.0032865,
    'https://e.gov.kw/sites/kgoenglish/Pages/Visitors/TourismInKuwait/ActivitiesInKuwaitAttractiveSpots.aspx',
    'https://www.openstreetmap.org/way/627399824', false
  ),
  (
    'al-shaheed-park', 'Al Shaheed Park', 'Al Shaheed Park',
    'A large public urban park with landscaped gardens and cultural, historical, and environmental spaces.',
    'Places', 'Soor Street, opposite Al Tijaria Tower, Kuwait City, Kuwait',
    29.3604283, 47.9795129,
    'https://www.greenroofs.com/projects/al-shaheed-park/',
    'https://www.openstreetmap.org/way/1451022213', false
  ),
  (
    'souq-al-mubarakiya', 'Souq Al-Mubarakiya', 'Souq Al-Mubarakiya',
    'A historic traditional bazaar in downtown Kuwait City, with shops, restaurants, and cafes.',
    'Places', 'Downtown Kuwait City, between Abdullah Al-Mubarak, Abdullah Al-Salem, and Palestine Streets',
    29.3738838, 47.9736262,
    'https://www.kuna.net.kw/ArticleDetails.aspx?id=2327233&language=en',
    'https://www.openstreetmap.org/node/13475942266', false
  ),
  (
    'sheikh-jaber-cultural-centre', 'Sheikh Jaber Al Ahmad Cultural Centre', 'Sheikh Jaber Al Ahmad Cultural Centre',
    'A cultural centre and performing-arts venue in Kuwait''s national cultural district.',
    'Places', 'Arabian Gulf Street, Shuwaikh, Block 8, Kuwait City, Kuwait',
    29.3603645, 47.9565218,
    'https://www.jacc-kw.com/plan-your-visit/how-to-get-here/',
    'https://www.openstreetmap.org/node/4559012302', false
  ),
  (
    'mais-alghanim-sharq', 'Mais Alghanim (Sharq)', 'Mais Alghanim (Sharq)',
    'Kuwaiti restaurant serving traditional home-style Lebanese and Middle Eastern cuisine. This pin is for the Sharq/Gulf Road branch.',
    'Restaurants & Cafes', 'Sharq, Arabian Gulf Road, overlooking Kuwait Towers, Kuwait City, Kuwait',
    29.3906141, 47.9983701,
    'https://www.bfc.com.kw/mais-alghanim/',
    'https://www.openstreetmap.org/node/9620574226', false
  ),
  (
    'freej-swaileh-salmiya', 'Freej Swaileh (Salmiya)', 'Freej Swaileh (Salmiya)',
    'Kuwaiti restaurant serving Middle Eastern cuisine. This pin is for the operator-listed Salmiya branch on Salem Al Mubarrak Street.',
    'Restaurants & Cafes', 'Salmiya, Salem Al Mubarrak Street, Kuwait',
    29.339119, 48.068127,
    'https://freej-swaeleh.com/branches',
    'https://maps.google.com/maps?saddr=&daddr=Salem%20Mubarak%20Street%20Salmiya,%20Kuwait%20City%20Kuwait@29.339119,48.068127', false
  ),
  (
    'cocoa-room-cultural-centre', 'Cocoa Room', 'Cocoa Room',
    'A restaurant known for breakfast and brunch, located at Sheikh Jaber Al-Ahmad Cultural Centre.',
    'Restaurants & Cafes', 'Sheikh Jaber Al-Ahmad Cultural Centre, Arabian Gulf Street, Kuwait City, Kuwait',
    29.3612571, 47.958792,
    'https://www.jacc-kw.com/eat-and-drink',
    'https://www.google.ae/maps/place/Cocoa+Room/@29.3612618,47.956598,17z/data=!3m1!4b1!4m5!3m4!1s0x3fcf85210063a545:0xf76ce731c5aef9e4!8m2!3d29.3612571!4d47.958792?hl=en', false
  ),
  (
    'scientific-center-kuwait', 'The Scientific Center of Kuwait', 'The Scientific Center of Kuwait',
    'A family-oriented science-learning center with hands-on exhibits, an aquarium, an IMAX theater, and educational programs.',
    'Family Activities', 'Gulf Road, Ras Al Ardh, Salmiya, Kuwait 22036',
    29.3496103, 48.0895244,
    'https://tsck.org.kw/',
    'https://www.openstreetmap.org/way/314148911', false
  ),
  (
    'kidzania-kuwait', 'KidZania Kuwait', 'KidZania Kuwait',
    'A child-focused edutainment attraction where children can explore role-play activities in a scaled-down city.',
    'Family Activities', 'Level 1, The Mall - The Avenues, Al Rai, Kuwait',
    29.3043737, 47.9371702,
    'https://locations.alshaya.com/kidzania-kuwait/kw/al-rai/the-mall-the-avenues-1st-floor',
    'https://www.openstreetmap.org/node/4514006599', false
  ),
  (
    'magic-planet-avenues', 'Magic Planet (The Avenues)', 'Magic Planet (The Avenues)',
    'Family entertainment and indoor trampoline activities at Level 1, The Avenues Mall. Map pin marks the mall centroid, not the exact tenant entrance.',
    'Family Activities', 'Level 1, The Avenues Mall, Rai, Al Farwaniya, Kuwait',
    29.3035362, 47.9390844,
    'https://www.magicplanetmena.com/en-kw/locations-and-timings?activeLocation=avenue-mall',
    'https://www.openstreetmap.org/way/164140967', false
  )
on conflict (slug) where (slug is not null) do update set
  name = excluded.name,
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  location = excluded.location,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  source_url = excluded.source_url,
  location_url = excluded.location_url,
  is_sample = excluded.is_sample;

insert into public.events (
  slug, title, date, location, description, category, source_url,
  latitude, longitude, is_sample
) values
  (
    'sample-demo-towers-family-night',
    '[SAMPLE ONLY - NOT REAL] Demo family night at Kuwait Towers',
    null,
    'Demo map anchor: Kuwait Towers; this is not an event location or announcement.',
    'FICTIONAL SAMPLE DATA FOR UI TESTING ONLY. No such event is being announced. The coordinates only point to the real Kuwait Towers landmark.',
    'Events', null, 29.3899212, 48.0032865, true
  ),
  (
    'sample-demo-cultural-centre-evening',
    '[SAMPLE ONLY - NOT REAL] Demo cultural-centre evening',
    null,
    'Demo map anchor: Sheikh Jaber Al Ahmad Cultural Centre; this is not an event announcement.',
    'FICTIONAL SAMPLE DATA FOR UI TESTING ONLY. This is not a scheduled performance or public event. The coordinates only point to the real cultural-centre venue.',
    'Events', null, 29.3603645, 47.9565218, true
  ),
  (
    'sample-demo-park-family-day',
    '[SAMPLE ONLY - NOT REAL] Demo family day at Al Shaheed Park',
    null,
    'Demo map anchor: Al Shaheed Park; this is not an event location or announcement.',
    'FICTIONAL SAMPLE DATA FOR UI TESTING ONLY. No family day is being announced. The coordinates only point to the real park landmark.',
    'Events', null, 29.3604283, 47.9795129, true
  ),
  (
    'sample-demo-market-walk',
    '[SAMPLE ONLY - NOT REAL] Demo market walk at Souq Al-Mubarakiya',
    null,
    'Demo map anchor: Souq Al-Mubarakiya; this is not an event location or announcement.',
    'FICTIONAL SAMPLE DATA FOR UI TESTING ONLY. This is not an organized tour or event. The coordinates only point to the real market area.',
    'Events', null, 29.3738838, 47.9736262, true
  ),
  (
    'sample-demo-brunch-gathering',
    '[SAMPLE ONLY - NOT REAL] Demo brunch gathering at Cocoa Room',
    null,
    'Demo map anchor: Cocoa Room at Sheikh Jaber Al-Ahmad Cultural Centre; this is not an event announcement.',
    'FICTIONAL SAMPLE DATA FOR UI TESTING ONLY. No gathering is being announced. The coordinates only point to the real restaurant venue.',
    'Events', null, 29.3612571, 47.958792, true
  )
on conflict (slug) where (slug) is not null do update set
  title = excluded.title,
  date = excluded.date,
  location = excluded.location,
  description = excluded.description,
  category = excluded.category,
  source_url = excluded.source_url,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  is_sample = excluded.is_sample;

commit;
