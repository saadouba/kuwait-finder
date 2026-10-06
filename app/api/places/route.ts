import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ places: [], note: "Places are not configured on this deployment yet." });
  }

  try {
    const { data: places, error } = await supabase
      .from("places")
      .select("*")
      .limit(30);

    if (error) throw error;
    return NextResponse.json({ places: places ?? [] });
  } catch (error) {
    console.error("Unable to load places:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ places: [], note: "Popular places are temporarily unavailable." });
  }
}
