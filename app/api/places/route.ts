import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Category = "Events" | "Places" | "Restaurants & Cafes" | "Family Activities";

function cleanText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 600) : fallback;
}

function coordinate(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function category(value: unknown, fallback: Category): Category {
  const valid: Category[] = ["Events", "Places", "Restaurants & Cafes", "Family Activities"];
  return valid.find((item) => item.toLowerCase() === String(value ?? "").trim().toLowerCase()) ?? fallback;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function missingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(error?.message ?? "");
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ items: [], places: [], events: [], note: "supabase-not-configured" });
  }

  const [placesResult, eventsResult] = await Promise.all([
    supabase.from("places").select("id,slug,name,title,description,category,location,latitude,longitude,source_url,location_url,is_sample").limit(100),
    supabase.from("events").select("id,slug,title,date,location,description,category,latitude,longitude,source_url,is_sample").order("date", { ascending: true, nullsFirst: false }).limit(100),
  ]);

  const notes: string[] = [];
  if (placesResult.error) {
    console.error("Unable to load directory places:", { code: placesResult.error.code || "database_error" });
    notes.push(missingTable(placesResult.error) ? "places-migration" : "places-unavailable");
  }
  if (eventsResult.error) {
    console.error("Unable to load directory events:", { code: eventsResult.error.code || "database_error" });
    notes.push(missingTable(eventsResult.error) ? "events-migration" : "events-unavailable");
  }

  const places = (placesResult.data ?? []).map((row) => ({
    id: String(row.id ?? row.slug ?? row.name ?? row.title ?? "place"),
    slug: typeof row.slug === "string" ? row.slug : undefined,
    title: cleanText(row.name ?? row.title, "Kuwait place"),
    date: null,
    location: cleanText(row.location, "Kuwait"),
    description: cleanText(row.description, "Explore this Kuwait destination."),
    category: category(row.category, "Places"),
    source_url: safeUrl(row.source_url ?? row.location_url),
    isCurated: true,
    isSample: Boolean(row.is_sample),
    latitude: coordinate(row.latitude, -90, 90),
    longitude: coordinate(row.longitude, -180, 180),
  }));

  const events = (eventsResult.data ?? []).map((row) => ({
    id: String(row.id ?? row.slug ?? row.title ?? "event"),
    slug: typeof row.slug === "string" ? row.slug : undefined,
    title: cleanText(row.title, "Kuwait event"),
    date: typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : null,
    location: cleanText(row.location, "Kuwait"),
    description: cleanText(row.description, "See the linked source for details."),
    category: "Events" as const,
    source_url: safeUrl(row.source_url),
    isCurated: true,
    isSample: Boolean(row.is_sample),
    latitude: coordinate(row.latitude, -90, 90),
    longitude: coordinate(row.longitude, -180, 180),
  }));

  const items = [...events, ...places];
  const note = notes.length > 0 ? notes.join(",") : null;
  return NextResponse.json({ items, places, events, note }, { headers: { "Cache-Control": "no-store" } });
}
