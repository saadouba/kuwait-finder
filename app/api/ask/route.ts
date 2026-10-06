import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  ASK_RATE_LIMIT,
  consumeAskRateLimit,
  createAnswerCacheKey,
  readCachedAnswer,
  redactSecrets,
  writeCachedAnswer,
} from "@/lib/search-protection";

export const runtime = "nodejs";

const KUWAIT_TIME_ZONE = "Asia/Kuwait";
const MAX_RESULTS_PER_DOMAIN = 6;
const DISCOVERY_CATEGORIES = ["Events", "Places", "Restaurants & Cafes", "Family Activities"] as const;
type DiscoveryCategory = typeof DISCOVERY_CATEGORIES[number];

type SearchResult = { title?: string; url?: string; content?: string; published_date?: string };
type DiscoveryItem = {
  title: string;
  date: string | null;
  location: string;
  description: string;
  category: DiscoveryCategory;
  source_url: string;
  isCurated: boolean;
  isSample: boolean;
  slug?: string;
  latitude: number | null;
  longitude: number | null;
};
type DateRange = { start: string; end: string } | null;
type Diagnostics = {
  tavilyReturned: number[];
  tavilyFailures: number;
  rawResults: number;
  validUrls: number;
  invalidUrlsDropped: number;
  duplicateUrlsDropped: number;
  explicitForeignDropped: number;
  ambiguousCandidates: number;
  domainLimitDropped: number;
  sourcesKept: number;
  groqItemsReceived: number;
  groqInvalidRowsDropped: number;
  groqUnknownSourcesDropped: number;
  groqForeignDropped: number;
  groqUnverifiedLocationDropped: number;
  groqPastDatesDropped: number;
  groqDateRangeDropped: number;
  webItemsKept: number;
  curatedItemsKept: number;
  cacheHit: boolean;
};

function newDiagnostics(): Diagnostics {
  return {
    tavilyReturned: [], tavilyFailures: 0, rawResults: 0, validUrls: 0,
    invalidUrlsDropped: 0, duplicateUrlsDropped: 0, explicitForeignDropped: 0,
    ambiguousCandidates: 0, domainLimitDropped: 0, sourcesKept: 0,
    groqItemsReceived: 0, groqInvalidRowsDropped: 0, groqUnknownSourcesDropped: 0,
    groqForeignDropped: 0, groqUnverifiedLocationDropped: 0, groqPastDatesDropped: 0,
    groqDateRangeDropped: 0, webItemsKept: 0, curatedItemsKept: 0, cacheHit: false,
  };
}

function logDiagnostics(requestId: string, diagnostics: Diagnostics) {
  if (process.env.SEARCH_DEBUG !== "true") return;
  // Deliberately restricted to counts and a correlation id; never include query text,
  // provider response content, client addresses, environment values, or API credentials.
  console.info("[search-debug]", JSON.stringify({ requestId, ...diagnostics }));
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(error?.message ?? "");
}

function kuwaitToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KUWAIT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateRangeForQuestion(question: string, today: string): DateRange {
  const normalized = question.toLowerCase();
  if (/\b(today|tonight)\b|اليوم|الليلة/.test(normalized)) return { start: today, end: today };
  if (/\bthis\s+weekend\b|عطلة نهاية الأسبوع|نهاية الأسبوع/.test(normalized)) {
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    const daysUntilFriday = (5 - weekday + 7) % 7;
    const start = weekday === 6 ? today : addDays(today, daysUntilFriday);
    return { start, end: weekday === 6 ? start : addDays(start, 1) };
  }
  if (/\bthis\s+week\b|هذا الأسبوع|خلال هذا الأسبوع/.test(normalized)) {
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    const daysUntilSaturday = (6 - weekday + 7) % 7;
    return { start: today, end: addDays(today, daysUntilSaturday) };
  }
  return null;
}

function rootDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const parts = host.split(".");
  const compoundSuffixes = new Set(["com.kw", "net.kw", "org.kw", "gov.kw", "edu.kw", "co.uk", "org.uk", "com.au", "com.sg", "co.in"]);
  return parts.length >= 3 && compoundSuffixes.has(parts.slice(-2).join(".")) ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
}

function normalizeUrl(value: string): { url: string; domain: string } | null {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return null;
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) parsed.searchParams.delete(key);
    parsed.pathname = parsed.pathname.replace(/\/$/, "") || "/";
    return { url: parsed.toString(), domain: rootDomain(parsed.hostname) };
  } catch {
    return null;
  }
}

const KUWAIT_SIGNALS = [
  /\bkuwait(?:i)?\b/i,
  /الكويت|كويتي|كويتية|الكويتية/,
  /\.kw(?:\/|$)/i,
  /\b(?:kuwait city|salmiya|hawally|jahra|ahmadi|farwaniya|fintas|mangaf|shuwaikh|salwa|mishref|jabriya|sabahiya|sabah al[- ]salem|mubarak al[- ]kabeer|fahaheel|mahboula|abu halifa|eqaila|bneid al[- ]gar|sharq|dasma|rumaithiya|qurain|kuwait towers|the avenues(?: kuwait)?|sheikh jaber al[- ]ahmad cultural centre|al shaheed park|souk al[- ]mubarakiya|scientific center kuwait|kuwait zoo|kidzania kuwait)\b/i,
];
const OTHER_COUNTRY_SIGNALS = [
  /\b(?:qatar|bahrain|oman|saudi arabia|united arab emirates|uae|dubai|abu dhabi|egypt|jordan|lebanon|iraq|iran|turkey|türkiye|india|pakistan|united states|usa|canada|united kingdom|england|france|germany|italy|spain|australia|singapore|malaysia|thailand|japan|china|morocco|tunisia|yemen|syria|palestine|israel|sudan|libya|algeria|cyprus|greece|netherlands|switzerland|sweden|norway|denmark|south korea|hong kong)\b/i,
  /قطر|البحرين|عمان|السعودية|الإمارات|دبي|أبو ظبي|مصر|الأردن|لبنان|العراق|إيران|تركيا|الهند|باكستان|المغرب|تونس|اليمن|سوريا|فلسطين|إسرائيل|السودان|ليبيا|الجزائر/,
];

function hasKuwaitSignal(text: string): boolean {
  return KUWAIT_SIGNALS.some((pattern) => pattern.test(text));
}

function hasForeignSignal(text: string): boolean {
  return OTHER_COUNTRY_SIGNALS.some((pattern) => pattern.test(text));
}

function isClearlyForeign(text: string): boolean {
  // A Kuwait-specific result can mention other countries in unrelated text. Only
  // reject an explicit foreign result when there is no Kuwait signal at all.
  return hasForeignSignal(text) && !hasKuwaitSignal(text);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function sourceConfirmsDate(date: string, sourceText: string): boolean {
  if (sourceText.includes(date)) return true;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const formats = [
    new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed),
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed),
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed),
  ];
  const normalized = sourceText.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ");
  return formats.some((format) => normalized.includes(format.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ")));
}

function sourceConfirmsLocation(location: unknown, sourceText: string): location is string {
  if (typeof location !== "string" || !location.trim()) return false;
  return sourceText.toLowerCase().includes(location.trim().toLowerCase());
}

function withinRange(date: string | null, today: string, range: DateRange): boolean {
  if (date === null) return true; // Keep source-supported events; render their date as unconfirmed.
  if (date < today) return false;
  return range === null || (date >= range.start && date <= range.end);
}

function safeCategory(value: unknown): DiscoveryCategory {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const found = DISCOVERY_CATEGORIES.find((category) => category.toLowerCase() === normalized);
  if (found) return found;
  if (/restaurant|cafe|café|food|dining/.test(normalized)) return "Restaurants & Cafes";
  if (/family|child|kid|play|activity|activities/.test(normalized)) return "Family Activities";
  if (/place|attraction|museum|park|visit|culture/.test(normalized)) return "Places";
  return "Events";
}

function cleanText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 600) : fallback;
}

function numericCoordinate(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

async function getCuratedEvents(today: string, range: DateRange, diagnostics: Diagnostics): Promise<{ items: DiscoveryItem[]; unavailable: boolean; missingTable: boolean }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { items: [], unavailable: true, missingTable: false };
  const { data, error } = await supabase
    .from("events")
    .select("slug,title,date,location,description,category,source_url,latitude,longitude,is_sample")
    .order("date", { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error("Unable to load curated events:", { code: error.code || "database_error" });
    return { items: [], unavailable: true, missingTable: isMissingTable(error) };
  }

  const items = (data ?? []).flatMap((row): DiscoveryItem[] => {
    if (row.is_sample) return []; // Demo rows are visible in the directory, never sold as real search matches.
    const date = isIsoDate(row.date) ? row.date : null;
    if (!withinRange(date, today, range)) return [];
    const sourceUrl = normalizeUrl(row.source_url ?? "")?.url;
    if (!sourceUrl) return []; // Real curated results must have a verifiable source.
    return [{
      slug: typeof row.slug === "string" ? row.slug : undefined,
      title: cleanText(row.title, "Untitled event"),
      date,
      location: cleanText(row.location, "Kuwait"),
      description: cleanText(row.description, "See the linked source for details."),
      category: "Events",
      source_url: sourceUrl,
      isCurated: true,
      isSample: false,
      latitude: numericCoordinate(row.latitude, -90, 90),
      longitude: numericCoordinate(row.longitude, -180, 180),
    }];
  });
  diagnostics.curatedItemsKept = items.length;
  return { items, unavailable: false, missingTable: false };
}

async function searchTavily(query: string, apiKey: string, diagnostics: Diagnostics): Promise<SearchResult[]> {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", include_answer: false, max_results: 10, topic: "general" }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) {
      diagnostics.tavilyFailures += 1;
      console.error("Tavily search returned an error:", { status: response.status });
      return [];
    }
    const result = await response.json();
    return Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    diagnostics.tavilyFailures += 1;
    console.error("Tavily search request failed:", error instanceof Error ? redactSecrets(error.message) : "Unknown error");
    return [];
  }
}

function mergeSearchResults(responses: SearchResult[][], diagnostics: Diagnostics): Array<SearchResult & { url: string }> {
  const seenUrls = new Set<string>();
  const domainCounts = new Map<string, number>();
  const merged: Array<SearchResult & { url: string }> = [];
  diagnostics.tavilyReturned = responses.map((response) => response.length);
  diagnostics.rawResults = responses.reduce((total, response) => total + response.length, 0);

  for (const result of responses.flat()) {
    if (!result.url) {
      diagnostics.invalidUrlsDropped += 1;
      continue;
    }
    const normalized = normalizeUrl(result.url);
    if (!normalized) {
      diagnostics.invalidUrlsDropped += 1;
      continue;
    }
    diagnostics.validUrls += 1;
    if (seenUrls.has(normalized.url)) {
      diagnostics.duplicateUrlsDropped += 1;
      continue;
    }
    const sourceText = `${result.title ?? ""} ${result.url} ${result.content ?? ""}`;
    if (isClearlyForeign(sourceText)) {
      diagnostics.explicitForeignDropped += 1;
      continue;
    }
    if (!hasKuwaitSignal(sourceText)) diagnostics.ambiguousCandidates += 1;
    const count = domainCounts.get(normalized.domain) ?? 0;
    if (count >= MAX_RESULTS_PER_DOMAIN) {
      diagnostics.domainLimitDropped += 1;
      continue;
    }
    seenUrls.add(normalized.url);
    domainCounts.set(normalized.domain, count + 1);
    merged.push({ ...result, url: normalized.url });
  }
  diagnostics.sourcesKept = merged.length;
  return merged;
}

function parseGroqItems(
  content: unknown,
  sources: Array<SearchResult & { url: string }>,
  today: string,
  range: DateRange,
  diagnostics: Diagnostics,
): DiscoveryItem[] {
  if (typeof content !== "string") return [];
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed: unknown = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { items?: unknown }).items)) return [];
    const candidates = (parsed as { items: unknown[] }).items;
    diagnostics.groqItemsReceived = candidates.length;
    const sourceByUrl = new Map(sources.map((source) => [source.url, `${source.title ?? ""} ${source.content ?? ""} ${source.url}`]));

    const items = candidates.flatMap((item): DiscoveryItem[] => {
      if (!item || typeof item !== "object") {
        diagnostics.groqInvalidRowsDropped += 1;
        return [];
      }
      const candidate = item as Record<string, unknown>;
      const normalized = typeof candidate.source_url === "string" ? normalizeUrl(candidate.source_url) : null;
      const sourceText = normalized ? sourceByUrl.get(normalized.url) : undefined;
      if (!normalized || !sourceText) {
        diagnostics.groqUnknownSourcesDropped += 1;
        return [];
      }
      if (isClearlyForeign(sourceText)) {
        diagnostics.groqForeignDropped += 1;
        return [];
      }
      if (!hasKuwaitSignal(sourceText)) {
        diagnostics.groqUnverifiedLocationDropped += 1;
        return [];
      }
      const candidateLocation = typeof candidate.location === "string" ? candidate.location.trim() : "";
      if (candidateLocation && isClearlyForeign(candidateLocation)) {
        diagnostics.groqForeignDropped += 1;
        return [];
      }

      let date: string | null = null;
      if (isIsoDate(candidate.date) && sourceConfirmsDate(candidate.date, sourceText)) date = candidate.date;
      if (date && date < today) {
        diagnostics.groqPastDatesDropped += 1;
        return [];
      }
      if (!withinRange(date, today, range)) {
        diagnostics.groqDateRangeDropped += 1;
        return [];
      }
      return [{
        title: cleanText(candidate.title, "Untitled discovery"),
        date,
        location: sourceConfirmsLocation(candidateLocation, sourceText) ? candidateLocation : "Kuwait",
        description: cleanText(candidate.description, "See the linked source for details."),
        category: safeCategory(candidate.category),
        source_url: normalized.url,
        isCurated: false,
        isSample: false,
        latitude: null,
        longitude: null,
      }];
    }).slice(0, 18);
    diagnostics.webItemsKept = items.length;
    return items;
  } catch (error) {
    console.error("Could not parse the Groq extraction response:", error instanceof Error ? redactSecrets(error.message) : "Invalid JSON");
    return [];
  }
}

function apiError(error: string, code: string, status: number, retryAfter?: number) {
  const response = NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "no-store" } });
  if (retryAfter !== undefined) response.headers.set("Retry-After", String(retryAfter));
  return response;
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const diagnostics = newDiagnostics();
  try {
    const body: unknown = await request.json();
    const question = body && typeof body === "object" ? (body as { question?: unknown }).question : null;
    if (typeof question !== "string" || !question.trim()) return apiError("A question is required.", "QUESTION_REQUIRED", 400);
    if (question.trim().length > 500) return apiError("Please keep your question under 500 characters.", "QUESTION_TOO_LONG", 400);

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return apiError("Search protection is not configured. Set the server-side Supabase variables and apply the search-protection migration.", "SEARCH_SETUP_REQUIRED", 503);
    }

    const limit = await consumeAskRateLimit(supabase, request);
    if (limit.errorCode) {
      logDiagnostics(requestId, diagnostics);
      console.error("Search rate-limit check failed:", { requestId, code: limit.errorCode });
      return apiError("Search protection is not ready. Apply the Supabase search-protection migration, then try again.", "SEARCH_SETUP_REQUIRED", 503);
    }
    if (!limit.ok) {
      logDiagnostics(requestId, diagnostics);
      return apiError("You have reached the short-term search limit. Please try again shortly.", "RATE_LIMITED", 429, limit.retryAfterSeconds);
    }

    const today = kuwaitToday();
    const range = dateRangeForQuestion(question, today);
    const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
    const cacheKey = createAnswerCacheKey(question, today, model);
    const cached = await readCachedAnswer(supabase, cacheKey);
    if (cached.errorCode) {
      logDiagnostics(requestId, diagnostics);
      console.error("Search cache lookup failed:", { requestId, code: cached.errorCode });
      return apiError("Search protection is not ready. Apply the Supabase search-protection migration, then try again.", "SEARCH_SETUP_REQUIRED", 503);
    }
    if (cached.payload && typeof cached.payload === "object") {
      diagnostics.cacheHit = true;
      logDiagnostics(requestId, diagnostics);
      return NextResponse.json(cached.payload, { headers: { "Cache-Control": "no-store", "X-Search-Cache": "HIT", "X-RateLimit-Limit": String(ASK_RATE_LIMIT), "X-RateLimit-Remaining": String(Math.max(0, ASK_RATE_LIMIT - (limit.count ?? 0))) } });
    }

    const curated = await getCuratedEvents(today, range, diagnostics);
    const tavilyKey = process.env.TAVILY_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    if (!tavilyKey || !groqKey) {
      const note = "Web search needs GROQ_API_KEY and TAVILY_API_KEY in server-side environment variables.";
      const payload = { items: curated.items, note, curatedUnavailable: curated.unavailable, curatedMissingTable: curated.missingTable };
      if (curated.items.length === 0) {
        logDiagnostics(requestId, diagnostics);
        return apiError(note, "SEARCH_PROVIDER_SETUP_REQUIRED", 503);
      }
      await writeCachedAnswer(supabase, cacheKey, payload);
      logDiagnostics(requestId, diagnostics);
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Search-Cache": "MISS" } });
    }

    const queries = [
      `${question.trim()} Kuwait`,
      `${question.trim()} Kuwait events activities`,
      `${question.trim()} الكويت فعاليات وأنشطة`,
    ];
    const searchResponses = await Promise.all(queries.map((query) => searchTavily(query, tavilyKey, diagnostics)));
    const sources = mergeSearchResults(searchResponses, diagnostics);
    let webItems: DiscoveryItem[] = [];

    if (sources.length > 0) {
      try {
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: `You extract useful, upcoming discoveries in Kuwait from the supplied search sources. Current date in Kuwait (${KUWAIT_TIME_ZONE}) is ${today}. Return only JSON: {"items":[{"title":"...","date":"YYYY-MM-DD or null","location":"source-confirmed venue or null","description":"...","category":"Events|Places|Restaurants & Cafes|Family Activities","source_url":"exact supplied URL"}]}. Use only facts explicitly supported by that source. Never invent or calculate dates: use null unless the source explicitly confirms a full calendar date with year. Keep an event with an unknown date when it is otherwise source-backed; do not omit it for a today/weekend question, and return date:null so the UI labels it unconfirmed. For known Kuwait results with no specific venue, location may be null and the app will display Kuwait. Include only content clearly about a location in Kuwait; do not extract neutral pages that do not establish Kuwait, and skip foreign-country results. For a date-window query, include events with confirmed dates only when in the window plus Kuwait events whose dates are unconfirmed. Category must be one of the four listed types. Every item must cite the exact URL of its supporting source. Return at most 18 items.`,
              },
              {
                role: "user",
                content: `Question: ${question.trim()}\nCurrent date: ${today}\nSources:\n${JSON.stringify(sources.map((source) => ({ title: source.title, url: source.url, content: source.content })))}`,
              },
            ],
            response_format: { type: "json_object" },
            reasoning_effort: "low",
          }),
          signal: AbortSignal.timeout(30_000),
          cache: "no-store",
        });

        if (!groqResponse.ok) {
          const errorBody = redactSecrets((await groqResponse.text()).slice(0, 4_000));
          console.error("Groq extraction returned an API error:", {
            requestId, model, status: groqResponse.status,
            providerRequestId: groqResponse.headers.get("x-request-id") ?? groqResponse.headers.get("x-groq-request-id"),
            error: redactSecrets(errorBody),
          });
        } else {
          const groqData = await groqResponse.json();
          webItems = parseGroqItems(groqData.choices?.[0]?.message?.content, sources, today, range, diagnostics);
        }
      } catch (error) {
        console.error("Groq extraction request failed:", { requestId, model, error: error instanceof Error ? redactSecrets(error.message) : "Unknown error" });
      }
    }

    const items = [...curated.items, ...webItems];
    const note = curated.missingTable
      ? "The curated events table is missing. Apply the directory and events migration to enable curated results."
      : curated.unavailable
        ? "Curated events could not be loaded. Check the Supabase connection and migration status."
      : items.length === 0
        ? "No source-backed matches were found. Try a broader query; results with unconfirmed dates are included when available."
        : null;
    const payload = { items, note, curatedUnavailable: curated.unavailable, curatedMissingTable: curated.missingTable };
    const cacheWrite = await writeCachedAnswer(supabase, cacheKey, payload);
    if (cacheWrite.errorCode) console.error("Search cache write failed:", { requestId, code: cacheWrite.errorCode });
    logDiagnostics(requestId, diagnostics);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
        "X-Search-Cache": "MISS",
        "X-RateLimit-Limit": String(ASK_RATE_LIMIT),
        "X-RateLimit-Remaining": String(Math.max(0, ASK_RATE_LIMIT - (limit.count ?? 0))),
      },
    });
  } catch (error) {
    logDiagnostics(requestId, diagnostics);
    console.error("Event search failed:", error instanceof Error ? redactSecrets(error.message) : "Unknown error");
    return apiError("Something went wrong while searching. Please try again.", "SEARCH_FAILED", 500);
  }
}
