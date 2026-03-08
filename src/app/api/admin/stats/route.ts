import { NextResponse } from "next/server";
import { requireAdmin, isErrorResponse } from "@/lib/admin";

export async function GET() {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const supabase = auth.adminClient;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Parallel queries
  const [
    usersRes,
    newWeekRes,
    newMonthRes,
    docsRes,
    docsMonthRes,
    errorDocsRes,
    profilesRes,
    integRes,
    docsUploadRes,
    docsEmailRes,
    avgExtRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfWeek),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "error"),
    supabase.from("profiles").select("subscription_tier"),
    supabase.from("user_integrations").select("user_id", { count: "exact", head: true }).eq("provider", "fakturoid"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("source", "upload"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("source", "email"),
    supabase.from("documents").select("extraction_duration_ms").not("extraction_duration_ms", "is", null),
  ]);

  const tiers = (profilesRes.data || []).reduce(
    (acc, p) => {
      const tier = p.subscription_tier || "free";
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const avgMs = avgExtRes.data && avgExtRes.data.length > 0
    ? Math.round(avgExtRes.data.reduce((sum, d) => sum + (d.extraction_duration_ms || 0), 0) / avgExtRes.data.length)
    : 0;

  const basicCount = tiers["basic"] || 0;
  const proCount = tiers["pro"] || 0;

  return NextResponse.json({
    total_users: usersRes.count || 0,
    new_users_this_week: newWeekRes.count || 0,
    new_users_this_month: newMonthRes.count || 0,
    total_documents: docsRes.count || 0,
    documents_this_month: docsMonthRes.count || 0,
    error_documents: errorDocsRes.count || 0,
    free_users: tiers["free"] || 0,
    basic_users: basicCount,
    pro_users: proCount,
    mrr_czk: basicCount * 179 + proCount * 279,
    fakturoid_users: integRes.count || 0,
    documents_from_upload: docsUploadRes.count || 0,
    documents_from_email: docsEmailRes.count || 0,
    avg_extraction_ms: avgMs,
  });
}
