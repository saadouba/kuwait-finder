# Kuwait Finder

**A bilingual discovery guide for real events, places, restaurants, and family activities across Kuwait.**

**Live demo:** [Coming soon](https://your-vercel-deployment.vercel.app)

## Screenshots

| Immersive desktop hero | Mobile experience |
| --- | --- |
| ![Kuwait Finder desktop hero](docs/screenshot-hero.png) | ![Kuwait Finder mobile experience](docs/screenshot-mobile.png) |

## Features

- **AI-powered discovery search** using three English and Arabic Tavily queries, with source-linked results.
- **Curated events first**, followed by web discoveries; events with unknown dates remain visible and are labeled.
- **Kuwait directory** with curated places, restaurants and cafes, and family activities.
- **English and Arabic** with full RTL layout and a language preference remembered in the browser.
- **Immersive 3D Kuwait Towers hero** with a mobile/lightweight fallback and reduced-motion support.
- **Interactive map** with category-filtered event and place pins using Leaflet and OpenStreetMap—no map API key required.
- **Supabase-backed request protection:** shared rate limiting and answer caching that work across Vercel serverless instances.
- **Clearly marked seed examples:** sample events are demo data, never represented as verified real-world events.

## Tech stack

| Layer | Technology |
| --- | --- |
| Web framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS 4 and custom CSS |
| 3D rendering | Three.js, React Three Fiber, and drei |
| Interactive map | Leaflet, React Leaflet, OpenStreetMap tiles |
| Web search | Tavily |
| AI extraction | Groq Chat Completions (JSON mode) |
| Database and protection | Supabase Postgres, RPC, and row-level security |
| Hosting | Vercel |

## How it works

1. A visitor asks a question in English or Arabic.
2. On a cache miss, the server runs three advanced Tavily searches in parallel: a category-aware English query, an English category variant, and an Arabic variant. Event queries include Kuwait's exact current date window and a one-year time range for dated pages (pages without a detectable publish date remain eligible); Tavily's cleaned page text is requested, but Groq receives full text from at most the top five sources.
3. The server merges results, removes duplicate URLs, drops clearly foreign-country sources, and applies a per-domain limit. Optional `SEARCH_DEBUG=true` diagnostics record stage counts only; queries, result contents, client IPs, and API keys are never logged by that mode.
4. Groq extracts only source-supported discoveries in the selected UI language. The server rechecks source URLs and explicitly stated dates, drops clearly past event listings, orders confirmed dates first, and keeps up to three undated events with a **Date not confirmed** label.
5. Verified curated events appear first, followed by web results. Expandable cards show source-backed descriptions and any verified date, time, venue, address, price, and category; **Show on map** focuses a pin when coordinates exist. Items without verified coordinates remain readable in the list but are not assigned guessed pins.

The search endpoint uses a Supabase RPC for **8 requests per client per minute** and stores an HMAC of the client address, not the address itself. Successful answers are cached in Supabase for **10 minutes** using a SHA-256 cache key; raw questions are not stored in the cache table. Both mechanisms are shared across serverless instances.

**Tavily search cost:** an advanced search costs 2 API credits. Each uncached question makes three searches (6 credits); event searches make one additional search only when trusted domains are configured (maximum 8 credits). At Tavily's current pay-as-you-go rate of $0.008 per credit, that is approximately **$0.048–$0.064 per uncached search**; plan rates differ and pricing can change. See Tavily's [official credit guide](https://docs.tavily.com/documentation/api-credits) for current terms. Add optional trusted publisher hostnames to [`config/search.ts`](config/search.ts); it is intentionally empty by default.

The 3D scene is lazy-loaded. The scene loader provides a lightweight CSS fallback for mobile, reduced-motion, data-saving, low-memory, low-core, and no-WebGL devices. Search controls and content are ordinary readable page elements above the decorative scene.

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/saadouba/kuwait-finder.git
cd kuwait-finder
npm install
```

### 2. Configure server-side environment variables

Copy the placeholder template, then add secret values to `.env.local` locally and to the hosting provider's secret manager in production. **Never commit `.env`, `.env.local`, or real keys.** Do not prefix these values with `NEXT_PUBLIC_`.

| Variable name | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Server-side Groq authentication |
| `GROQ_MODEL` | Groq model; defaults to `openai/gpt-oss-120b` |
| `TAVILY_API_KEY` | Server-side Tavily authentication |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Server-only Supabase service-role key |
| `SEARCH_DEBUG` | Optional server-only count diagnostics (`true` or `false`) |

### 3. Apply the Supabase SQL

In the Supabase SQL Editor, apply the migrations in filename order:

1. [`supabase/migrations/20261005000000_create_events_table.sql`](supabase/migrations/20261005000000_create_events_table.sql) — base curated events table.
2. [`supabase/migrations/20261006160000_directory_map_search_protection.sql`](supabase/migrations/20261006160000_directory_map_search_protection.sql) — directory columns and coordinates, sample flags, durable answer cache, rate-limit table and RPC, and server-role access.
3. [`supabase/migrations/20261008150000_event_detail_fields.sql`](supabase/migrations/20261008150000_event_detail_fields.sql) — event date ranges, time, venue, address, price, and long descriptions, plus directory detail fields.

Then optionally run [`supabase/seed/20261006_kuwait_finder_sample_seed.sql`](supabase/seed/20261006_kuwait_finder_sample_seed.sql) to populate ten researched Kuwait places and five conspicuously marked sample event rows. The sample event records are for testing only; they are not real event announcements. Replace them with source-verified events before using the directory as an events guide.

The event table's `date`, `latitude`, and `longitude` fields are nullable. Use `source_url` for a verifiable source, and set `is_sample` to `false` only for real, source-checked listings. `events` stores the Events category; `places` stores Places, Restaurants & Cafes, and Family Activities with coordinates. Both tables use row-level security; the service key is used only by server routes.

If the API reports that search protection is not ready, confirm that all three migrations ran and that the Supabase variables are configured. If a table or detail column is missing, the UI shows a friendly setup notice while the SQL is applied.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Import `saadouba/kuwait-finder` into Vercel and select the Next.js framework preset.
2. Add the four required server-side secrets above under **Project Settings → Environment Variables**. `GROQ_MODEL` is optional (defaults to `openai/gpt-oss-120b`); `SEARCH_DEBUG` is also optional and enables count-only server logs.
3. Apply all three Supabase migrations and, if desired, the sample seed SQL. Do not place the service-role key in client-side variables.
4. Deploy the selected branch and verify search, curated-first results, category filters, map pins, and the English/Arabic toggle.
5. OpenStreetMap tiles require visible attribution. The map intentionally uses the public OSM tile service; follow its usage policy and avoid bulk or offline tile downloads.

## Project structure

```text
app/
  api/ask/route.ts                         # Search, source checks, date windows, diagnostics
  api/places/route.ts                      # Curated directory and map-pin feed
  components/HeroSceneLoader.tsx           # Lazy 3D scene and capability fallback
  components/KuwaitScene.tsx               # React Three Fiber Kuwait-inspired scene
  components/KuwaitMap.tsx                 # Client-only Leaflet/OpenStreetMap map
  globals.css                              # Dark, responsive, RTL-aware visual system
  layout.tsx                               # Fonts, metadata, and global styles
  page.tsx                                 # Search, filters, results, directory, map toggle
config/
  search.ts                                # Optional trusted event publisher domains
lib/
  search-protection.ts                      # Supabase-backed rate limit/cache helpers
  supabase-server.ts                        # Server-only Supabase client
supabase/
  migrations/                              # Database migrations
  seed/                                    # User-run sample seed data
docs/                                      # Desktop and mobile screenshots
```

## Known limitations

- Web-search coverage, source snippets, and freshness depend on Tavily and the pages it indexes.
- Some events do not publish a full date. Those results can appear with **Date not confirmed**; confirmed dates outside a requested Kuwait date window are excluded.
- Source results without trustworthy coordinates are shown in the list rather than assigned guessed map pins. The map shows database-backed locations with verified coordinates.
- Seed event rows are obvious **sample/demo data**, not real event listings; curated live events require a trustworthy source URL.
- The public OpenStreetMap tile service has usage policies and is not intended for bulk tile fetching.
- The 3D background is disabled on constrained or reduced-motion devices; this does not disable search or reading.
- There are no accounts, favorites, or user-submitted-event workflow.

## Roadmap

- Build a trusted event-curation workflow and replace demo rows with source-verified listings.
- Improve source-quality evaluation and query coverage, including Arabic discovery.
- Add optional date and neighborhood filters without inferring facts.
- Add populated category-list and filtered-map screenshots after applying the sample seed SQL.

## Author

Built by **Saad** — [github.com/saadouba](https://github.com/saadouba).
