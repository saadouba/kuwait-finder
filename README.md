# Kuwait Finder

A mobile-first English/Arabic finder for events, activities, and places across Kuwait. The existing Next.js App Router app uses server-side Tavily search, Groq extraction, and Supabase for curated events and places.

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- A Supabase project
- Groq and Tavily API keys

## Local setup

```bash
npm ci
cp .env.example .env.local
```

Set the values in `.env.local` on your machine or deployment environment. Never commit `.env`, `.env.local`, or any secret values. All API credentials are read by server-only code; do not prefix them with `NEXT_PUBLIC_`.

Required variables:

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Server-side Groq event extraction |
| `GROQ_MODEL` | Groq model (defaults to `openai/gpt-oss-120b`) |
| `TAVILY_API_KEY` | Server-side Tavily search |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Server-only Supabase service-role key |

## Supabase setup

Apply the migration in `supabase/migrations/20261005000000_create_events_table.sql` to create the `public.events` table. The app reads curated events through its server-side service-role client; row-level security is enabled and no public client policies are created. Add curated rows in Supabase with a title and any confirmed date, location, description, category, and source URL. Leave unknown dates or locations empty rather than estimating them.

The existing `public.places` table is still used for the popular-places section.

## Run and validate

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

## Search behavior

Each question triggers three parallel Tavily searches (English, English with “events activities”, and Arabic). Results are merged, URL-deduplicated, and limited to three per root domain. Search sources from other countries are rejected. Groq is instructed to use only source-supported details; the server independently checks Kuwait relevance, source URLs, explicit ISO dates, and requested date windows. “This weekend” means Friday–Saturday in Kuwait, “today/tonight” means the current Kuwait date, and “this week” means today through Saturday. Unknown dates and locations remain `null`; the UI labels unknown dates clearly. Curated upcoming events are returned before web results.
