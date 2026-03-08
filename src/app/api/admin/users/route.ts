import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isErrorResponse } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const search = url.searchParams.get("search") || "";
  const tier = url.searchParams.get("tier") || "";

  const supabase = auth.adminClient;

  // Get users from auth with pagination
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page,
    perPage: limit,
  });

  if (authError) {
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }

  let authUsers = authData.users || [];

  // Filter by email search
  if (search) {
    authUsers = authUsers.filter((u) =>
      u.email?.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Get profiles for these users
  const userIds = authUsers.map((u) => u.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, subscription_tier, is_admin, inbound_email_token")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  // Get document counts
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: docCounts } = await supabase
    .from("documents")
    .select("user_id, created_at")
    .in("user_id", userIds);

  const { data: integrations } = await supabase
    .from("user_integrations")
    .select("user_id, provider")
    .in("user_id", userIds)
    .eq("provider", "fakturoid");

  const integSet = new Set((integrations || []).map((i) => i.user_id));

  // Compute per-user doc stats
  const userDocStats = new Map<string, { total: number; month: number; lastAt: string | null }>();
  for (const doc of docCounts || []) {
    const stats = userDocStats.get(doc.user_id) || { total: 0, month: 0, lastAt: null };
    stats.total++;
    if (doc.created_at >= startOfMonth) stats.month++;
    if (!stats.lastAt || doc.created_at > stats.lastAt) stats.lastAt = doc.created_at;
    userDocStats.set(doc.user_id, stats);
  }

  let users = authUsers.map((u) => {
    const profile = profileMap.get(u.id);
    const docStats = userDocStats.get(u.id) || { total: 0, month: 0, lastAt: null };
    return {
      id: u.id,
      email: u.email || "",
      created_at: u.created_at,
      subscription_tier: profile?.subscription_tier || "free",
      is_admin: profile?.is_admin || false,
      documents_total: docStats.total,
      documents_this_month: docStats.month,
      last_document_at: docStats.lastAt,
      has_fakturoid: integSet.has(u.id),
      inbound_email_token: profile?.inbound_email_token || "",
    };
  });

  // Filter by tier
  if (tier) {
    users = users.filter((u) => u.subscription_tier === tier);
  }

  return NextResponse.json({
    users,
    total: authData.total || users.length,
  });
}
