import "server-only";

import { createHash, createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ASK_RATE_LIMIT = 8;
export const ANSWER_CACHE_TTL_MS = 10 * 60 * 1000;

export type RateLimitResult = {
  ok: boolean;
  count: number | null;
  retryAfterSeconds: number;
  errorCode?: string;
};

export async function consumeAskRateLimit(
  supabase: SupabaseClient,
  request: Request,
): Promise<RateLimitResult> {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    return { ok: false, count: null, retryAfterSeconds: 60, errorCode: "missing_service_key" };
  }

  const address = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown-client";
  const clientHash = createHmac("sha256", serviceKey).update(address).digest("hex");
  const now = new Date();
  const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const { data, error } = await supabase.rpc("consume_search_rate_limit", {
    p_client_hash: clientHash,
    p_bucket_start: minuteStart.toISOString(),
    p_limit: ASK_RATE_LIMIT,
  });

  if (error || typeof data !== "number") {
    return {
      ok: false,
      count: null,
      retryAfterSeconds: Math.max(1, Math.ceil((minuteStart.getTime() + 60_000 - now.getTime()) / 1000)),
      errorCode: error?.code || "invalid_rate_limit_response",
    };
  }

  return {
    ok: data <= ASK_RATE_LIMIT,
    count: data,
    retryAfterSeconds: Math.max(1, Math.ceil((minuteStart.getTime() + 60_000 - now.getTime()) / 1000)),
  };
}

export function createAnswerCacheKey(question: string, today: string, model: string): string {
  const normalizedQuestion = question.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  return createHash("sha256").update(`kuwait-finder:v2:${today}:${model}:${normalizedQuestion}`).digest("hex");
}

export async function readCachedAnswer(
  supabase: SupabaseClient,
  cacheKey: string,
): Promise<{ payload: unknown | null; errorCode?: string }> {
  const { data, error } = await supabase
    .from("search_answer_cache")
    .select("payload")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) return { payload: null, errorCode: error.code || "cache_read_failed" };
  return { payload: data?.payload ?? null };
}

export async function writeCachedAnswer(
  supabase: SupabaseClient,
  cacheKey: string,
  payload: unknown,
): Promise<{ errorCode?: string }> {
  const expiresAt = new Date(Date.now() + ANSWER_CACHE_TTL_MS).toISOString();
  const { error: cleanupError } = await supabase
    .from("search_answer_cache")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (cleanupError) return { errorCode: cleanupError.code || "cache_cleanup_failed" };
  const { error } = await supabase
    .from("search_answer_cache")
    .upsert({ cache_key: cacheKey, payload, expires_at: expiresAt }, { onConflict: "cache_key" });
  return error ? { errorCode: error.code || "cache_write_failed" } : {};
}

export function redactSecrets(value: string): string {
  let safe = value;
  const secrets = [
    process.env.GROQ_API_KEY,
    process.env.TAVILY_API_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  ].filter((secret): secret is string => Boolean(secret && secret.length > 7));

  for (const secret of secrets) safe = safe.split(secret).join("[REDACTED]");
  return safe
    .replace(/\bBearer\s+[^\s"'`]+/gi, "Bearer [REDACTED]")
    .replace(/((?:api[_-]?key|service[_-]?role[_-]?key)["'\s:=]+)[^\s,"'}]+/gi, "$1[REDACTED]")
    .replace(/\b(?:gsk|tvly)[-_][A-Za-z0-9_-]{8,}\b/gi, "[REDACTED]");
}
