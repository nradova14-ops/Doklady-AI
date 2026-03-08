import { NextResponse } from "next/server";
import { requireAdmin, isErrorResponse } from "@/lib/admin";

// Claude Sonnet 4 pricing (per 1M tokens)
const PRICE_INPUT_PER_M = 3;
const PRICE_OUTPUT_PER_M = 15;
const PRICE_CACHE_READ_PER_M = 0.3;
const PRICE_CACHE_CREATE_PER_M = 3.75;

export async function GET() {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const supabase = auth.adminClient;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [todayLogs, weekLogs, monthLogs, weekLogsWithDate] = await Promise.all([
    supabase
      .from("extraction_logs")
      .select("status, duration_ms, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens")
      .gte("created_at", startOfDay),
    supabase
      .from("extraction_logs")
      .select("status, duration_ms, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens")
      .gte("created_at", startOfWeek),
    supabase
      .from("extraction_logs")
      .select("input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens")
      .gte("created_at", startOfMonth),
    supabase
      .from("extraction_logs")
      .select("status, created_at")
      .gte("created_at", startOfWeek),
  ]);

  const todayData = todayLogs.data || [];
  const weekData = weekLogs.data || [];
  const monthData = monthLogs.data || [];

  // Avg extraction duration
  const todayDone = todayData.filter((d) => d.duration_ms != null && d.status === "success");
  const weekDone = weekData.filter((d) => d.duration_ms != null && d.status === "success");

  const avgToday = todayDone.length > 0
    ? Math.round(todayDone.reduce((s, d) => s + (d.duration_ms || 0), 0) / todayDone.length)
    : 0;
  const avgWeek = weekDone.length > 0
    ? Math.round(weekDone.reduce((s, d) => s + (d.duration_ms || 0), 0) / weekDone.length)
    : 0;

  // Error rates
  const todayErrors = todayData.filter((d) => d.status === "error").length;
  const weekErrors = weekData.filter((d) => d.status === "error").length;
  const errorRateToday = todayData.length > 0 ? Math.round((todayErrors / todayData.length) * 100) : 0;
  const errorRateWeek = weekData.length > 0 ? Math.round((weekErrors / weekData.length) * 100) : 0;

  // Real token usage this month
  const totalInputTokens = monthData.reduce((s, d) => s + (d.input_tokens || 0), 0);
  const totalOutputTokens = monthData.reduce((s, d) => s + (d.output_tokens || 0), 0);
  const totalCacheReadTokens = monthData.reduce((s, d) => s + (d.cache_read_tokens || 0), 0);
  const totalCacheCreateTokens = monthData.reduce((s, d) => s + (d.cache_creation_tokens || 0), 0);

  const costUsd =
    (totalInputTokens / 1_000_000) * PRICE_INPUT_PER_M +
    (totalOutputTokens / 1_000_000) * PRICE_OUTPUT_PER_M +
    (totalCacheReadTokens / 1_000_000) * PRICE_CACHE_READ_PER_M +
    (totalCacheCreateTokens / 1_000_000) * PRICE_CACHE_CREATE_PER_M;

  // Daily extractions for last 7 days
  const dailyExtractions: { date: string; count: number; errors: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = day.toISOString().split("T")[0];
    dailyExtractions.push({ date: dayStr, count: 0, errors: 0 });
  }

  for (const entry of dailyExtractions) {
    const dayLogs = (weekLogsWithDate.data || []).filter((d) =>
      d.created_at.startsWith(entry.date)
    );
    entry.count = dayLogs.length;
    entry.errors = dayLogs.filter((d) => d.status === "error").length;
  }

  return NextResponse.json({
    avg_extraction_ms_today: avgToday,
    avg_extraction_ms_week: avgWeek,
    extractions_today: todayData.length,
    extractions_week: weekData.length,
    error_rate_today: errorRateToday,
    error_rate_week: errorRateWeek,
    tokens_this_month: {
      input: totalInputTokens,
      output: totalOutputTokens,
      cache_read: totalCacheReadTokens,
      cache_creation: totalCacheCreateTokens,
      total: totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheCreateTokens,
    },
    cost_usd: Math.round(costUsd * 100) / 100,
    extractions_this_month: monthData.length,
    daily_extractions: dailyExtractions,
  });
}
