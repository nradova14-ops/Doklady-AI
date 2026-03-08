import { NextResponse } from "next/server";
import { requireAdmin, isErrorResponse } from "@/lib/admin";

export async function GET() {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const supabase = auth.adminClient;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [todayDocs, weekDocs, monthDocs] = await Promise.all([
    supabase
      .from("documents")
      .select("status, extraction_duration_ms")
      .gte("created_at", startOfDay),
    supabase
      .from("documents")
      .select("status, extraction_duration_ms")
      .gte("created_at", startOfWeek),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfMonth)
      .eq("status", "done"),
  ]);

  const todayData = todayDocs.data || [];
  const weekData = weekDocs.data || [];

  const todayDone = todayData.filter((d) => d.extraction_duration_ms != null);
  const weekDone = weekData.filter((d) => d.extraction_duration_ms != null);

  const avgToday = todayDone.length > 0
    ? Math.round(todayDone.reduce((s, d) => s + (d.extraction_duration_ms || 0), 0) / todayDone.length)
    : 0;
  const avgWeek = weekDone.length > 0
    ? Math.round(weekDone.reduce((s, d) => s + (d.extraction_duration_ms || 0), 0) / weekDone.length)
    : 0;

  const todayErrors = todayData.filter((d) => d.status === "error").length;
  const weekErrors = weekData.filter((d) => d.status === "error").length;

  const errorRateToday = todayData.length > 0 ? Math.round((todayErrors / todayData.length) * 100) : 0;
  const errorRateWeek = weekData.length > 0 ? Math.round((weekErrors / weekData.length) * 100) : 0;

  // Estimate Claude API costs (~1500 tokens per extraction, $3/1M input tokens)
  const extractionsThisMonth = monthDocs.count || 0;
  const estimatedTokens = extractionsThisMonth * 1500;
  const estimatedCostUsd = Math.round((estimatedTokens / 1_000_000) * 3 * 100) / 100;

  // Daily extractions for last 7 days
  const dailyExtractions: { date: string; count: number; errors: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = day.toISOString().split("T")[0];
    dailyExtractions.push({ date: dayStr, count: 0, errors: 0 });
  }

  // Get daily breakdown properly
  const { data: weekDocsWithDate } = await supabase
    .from("documents")
    .select("status, created_at")
    .gte("created_at", startOfWeek);

  for (const entry of dailyExtractions) {
    const dayDocs = (weekDocsWithDate || []).filter((d) =>
      d.created_at.startsWith(entry.date)
    );
    entry.count = dayDocs.length;
    entry.errors = dayDocs.filter((d) => d.status === "error").length;
  }

  return NextResponse.json({
    avg_extraction_ms_today: avgToday,
    avg_extraction_ms_week: avgWeek,
    extractions_today: todayData.length,
    extractions_week: weekData.length,
    error_rate_today: errorRateToday,
    error_rate_week: errorRateWeek,
    estimated_tokens_this_month: estimatedTokens,
    estimated_cost_usd: estimatedCostUsd,
    daily_extractions: dailyExtractions,
  });
}
