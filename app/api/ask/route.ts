import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const KUWAIT_TIME_ZONE = "Asia/Kuwait";
const EVENT_CATEGORIES = [
  "Family",
  "Culture",
  "Food",
  "Sports",
  "Entertainment",
  "Nature",
  "Shopping",
  "Other",
] as const;

type SearchResult = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
};

type EventItem = {
  title: string;
  date: string | null;
  location: string | null;
  description: string;
  category: string;
  source_url: string | null;
  isCurated: boolean;
};

type DateRange = { start: string; end: string } | null;

function kuwaitToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KUWAIT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
  if (/\b(today|tonight)\b|اليوم|الليلة/.test(normalized)) {
    return { start: today, end: today };
  }
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
  const compoundSuffixes = new Set([
    "com.kw", "net.kw", "org.kw", "gov.kw", "edu.kw",
    "co.uk", "org.uk", "com.au", "com.sg", "co.in",
  ]);
  const suffix = parts.slice(-2).join(".");
  return parts.length >= 3 && compoundSuffixes.has(suffix)
    ? parts.slice(-3).join(".")
    : parts.slice(-2).join(".");
}

function normalizeUrl(value: string): { url: string; domain: string } | null {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return null;
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) parsed.searchParams.delete(key);
    }
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
  /\b(?:kuwait city|salmiya|hawally|jahra|ahmadi|farwaniya|fintas|mangaf|shuwaikh|salwa|mishref|jabriya|sabahiya|sabah al[- ]salem|mubarak al[- ]kabeer|kuwait towers|the avenues kuwait|sheikh jaber al[- ]ahmad cultural centre)\b/i,
];

const OTHER_COUNTRY_SIGNALS = [
  /\b(?:qatar|bahrain|oman|saudi arabia|united arab emirates|uae|dubai|abu dhabi|egypt|jordan|lebanon|iraq|iran|turkey|türkiye|india|pakistan|united states|usa|canada|united kingdom|england|france|germany|italy|spain|australia|singapore|malaysia|thailand|japan|china|morocco|tunisia|yemen|syria|palestine|israel|sudan|libya|algeria|cyprus|greece|netherlands|switzerland|sweden|norway|denmark|south korea|hong kong)\b/i,
  /قطر|البحرين|عمان|السعودية|الإمارات|دبي|أبو ظبي|مصر|الأردن|لبنان|العراق|إيران|تركيا|الهند|باكستان|المغرب|تونس|اليمن|سوريا|فلسطين|إسرائيل|السودان|ليبيا|الجزائر/,
];

function isKuwaitSource(text: string): boolean {
  if (OTHER_COUNTRY_SIGNALS.some((pattern) => pattern.test(text))) return false;
  return KUWAIT_SIGNALS.some((pattern) => pattern.test(text));
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
  const normalizedSource = sourceText.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ");
  return formats.some((format) => normalizedSource.includes(format.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ")));
}

function sourceConfirmsLocation(location: unknown, sourceText: string): location is string {
  if (typeof location !== "string" || !location.trim()) return false;
  const normalizedSource = sourceText.toLowerCase();
  const normalizedLocation = location.trim().toLowerCase();
  return normalizedSource.includes(normalizedLocation) && isKuwaitSource(sourceText);
}

function withinRange(date: string | null, today: string, range: DateRange): boolean {
  if (date === null) return range === null;
  if (date < today) return false;
  return range === null || (date >= range.start && date <= range.end);
}

function safeCategory(value: unknown): string {
  return EVENT_CATEGORIES.find((category) => category.toLowerCase() === String(value).toLowerCase()) ?? "Other";
}

function cleanText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 600) : fallback;
}

function getCuratedEvents(today: string, range: DateRange): Promise<{ items: EventItem[]; unavailable: boolean }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Promise.resolve({ items: [], unavailable: true });

  return (async () => {
    const { data, error } = await supabase
      .from("events")
      .select("title,date,location,description,category,source_url")
      .order("date", { ascending: true, nullsFirst: false })
      .limit(100);

    if (error) {
      console.error("Unable to load curated events:", error.message);
      return { items: [], unavailable: true };
    }

    const items = (data ?? []).flatMap((row): EventItem[] => {
      const date = isIsoDate(row.date) ? row.date : null;
      if (!withinRange(date, today, range)) return [];
      const sourceText = `${row.title ?? ""} ${row.location ?? ""} ${row.description ?? ""}`;
      if (OTHER_COUNTRY_SIGNALS.some((pattern) => pattern.test(sourceText))) return [];
      return [{
        title: cleanText(row.title, "Untitled event"),
        date,
        location: typeof row.location === "string" && row.location.trim() ? row.location.trim() : null,
        description: cleanText(row.description, "More details are available from the event source."),
        category: safeCategory(row.category),
        source_url: normalizeUrl(row.source_url ?? "")?.url ?? null,
        isCurated: true,
      }];
    });
    return { items, unavailable: false };
  })();
}

async function searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: false,
        max_results: 8,
        topic: "general",
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`Tavily search returned status ${response.status}.`);
      return [];
    }
    const result = await response.json();
    return Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    console.error("Tavily search request failed:", error instanceof Error ? error.message : "Unknown error");
    return [];
  }
}

function mergeSearchResults(responses: SearchResult[][]): Array<SearchResult & { url: string }> {
  const seenUrls = new Set<string>();
  const domainCounts = new Map<string, number>();
  const merged: Array<SearchResult & { url: string }> = [];

  for (const result of responses.flat()) {
    if (!result.url) continue;
    const normalized = normalizeUrl(result.url);
    if (!normalized || seenUrls.has(normalized.url)) continue;
    const sourceText = `${result.title ?? ""} ${result.url} ${result.content ?? ""}`;
    if (!isKuwaitSource(sourceText)) continue;

    const count = domainCounts.get(normalized.domain) ?? 0;
    if (count >= 3) continue;
    seenUrls.add(normalized.url);
    domainCounts.set(normalized.domain, count + 1);
    merged.push({ ...result, url: normalized.url });
  }
  return merged;
}

function parseGroqItems(content: unknown, sources: Array<SearchResult & { url: string }>, today: string, range: DateRange): EventItem[] {
  if (typeof content !== "string") return [];
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed: unknown = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { items?: unknown }).items)) return [];
    const sourceByUrl = new Map(sources.map((source) => [source.url, `${source.title ?? ""} ${source.content ?? ""} ${source.url}`]));

    return ((parsed as { items: unknown[] }).items).flatMap((item): EventItem[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      const normalized = typeof candidate.source_url === "string" ? normalizeUrl(candidate.source_url) : null;
      if (!normalized) return [];
      const sourceText = sourceByUrl.get(normalized.url);
      if (!sourceText || !isKuwaitSource(sourceText)) return [];

      let date: string | null = null;
      if (isIsoDate(candidate.date) && sourceConfirmsDate(candidate.date, sourceText)) date = candidate.date;
      if (!withinRange(date, today, range)) return [];

      const location = sourceConfirmsLocation(candidate.location, sourceText) ? candidate.location.trim() : null;
      return [{
        title: cleanText(candidate.title, "Untitled event"),
        date,
        location,
        description: cleanText(candidate.description, "See the linked source for details."),
        category: safeCategory(candidate.category),
        source_url: normalized.url,
        isCurated: false,
      }];
    }).slice(0, 12);
  } catch {
    console.error("Could not parse the event extraction response as JSON.");
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const question = body && typeof body === "object" ? (body as { question?: unknown }).question : null;
    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }
    if (question.trim().length > 500) {
      return NextResponse.json({ error: "Please keep your question under 500 characters." }, { status: 400 });
    }

    const today = kuwaitToday();
    const range = dateRangeForQuestion(question, today);
    const curated = await getCuratedEvents(today, range);
    const tavilyKey = process.env.TAVILY_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!tavilyKey || !groqKey) {
      if (curated.items.length > 0) {
        return NextResponse.json({ items: curated.items, note: "Web search is not configured; showing curated events only." });
      }
      return NextResponse.json({ error: "Search is not configured. Add the required server environment variables." }, { status: 503 });
    }

    const queries = [
      `${question.trim()} Kuwait`,
      `${question.trim()} Kuwait events activities`,
      `${question.trim()} الكويت فعاليات وأنشطة`,
    ];
    const searchResponses = await Promise.all(queries.map((query) => searchTavily(query, tavilyKey)));
    const sources = mergeSearchResults(searchResponses);
    let webItems: EventItem[] = [];

    if (sources.length > 0) {
      const groqModel = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
      let groqResponse: Response | null = null;

      try {
        groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              {
                role: "system",
                content: `You extract real upcoming events in Kuwait from provided search snippets. The current date in Kuwait is ${today} (${KUWAIT_TIME_ZONE}). The user's exact query is provided separately. Return only JSON: {"items":[{"title":"...","date":"YYYY-MM-DD or null","location":"... or null","description":"...","category":"Family|Culture|Food|Sports|Entertainment|Nature|Shopping|Other","source_url":"exact supplied URL"}]}. Use only facts explicitly supported by that source. Never infer or calculate event dates; if the source does not explicitly state a full calendar date with a year, date must be null. Never infer a venue or location; use null unless named in the source. Include only events actually located in Kuwait; skip other countries and unrelated results. Do not include past events. For today, tonight, this weekend (Friday and Saturday in Kuwait), or this week (today through Saturday), return only events in that date window; when an event date is not explicitly confirmed, omit it for a date-window question. Keep descriptions factual and brief. Categorize only when the source supports it. Return at most 12 items.`,
              },
              {
                role: "user",
                content: `Question: ${question.trim()}\nCurrent date: ${today}\nSearch sources:\n${JSON.stringify(sources.map((source) => ({ title: source.title, url: source.url, content: source.content })))}`,
              },
            ],
            // Groq JSON Object Mode requires response_format plus an explicit JSON instruction above.
            response_format: { type: "json_object" },
            reasoning_effort: "low",
          }),
          signal: AbortSignal.timeout(30_000),
          cache: "no-store",
        });
      } catch (error) {
        console.error("Groq extraction request failed:", {
          model: groqModel,
          error: error instanceof Error ? error.message : String(error),
        });
        if (curated.items.length === 0) {
          return NextResponse.json({ error: "Event extraction is temporarily unavailable. Please try again." }, { status: 502 });
        }
      }

      if (groqResponse && !groqResponse.ok) {
        const errorBody = await groqResponse.text();
        console.error("Groq extraction returned an API error:", {
          model: groqModel,
          status: groqResponse.status,
          requestId: groqResponse.headers.get("x-request-id") ?? groqResponse.headers.get("x-groq-request-id"),
          body: errorBody.slice(0, 4_000),
        });
        if (curated.items.length === 0) {
          return NextResponse.json({ error: "Event extraction is temporarily unavailable. Please try again." }, { status: 502 });
        }
      } else if (groqResponse?.ok) {
        const groqData = await groqResponse.json();
        webItems = parseGroqItems(groqData.choices?.[0]?.message?.content, sources, today, range);
      }
    }

    const note = curated.unavailable
      ? "Curated events are not available yet. Apply the events-table migration to enable them."
      : webItems.length === 0
        ? "No source-confirmed web events matched this search. Try another query or check back later."
        : null;

    return NextResponse.json({ items: [...curated.items, ...webItems], note });
  } catch (error) {
    console.error("Event search failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Something went wrong while searching. Please try again." }, { status: 500 });
  }
}
