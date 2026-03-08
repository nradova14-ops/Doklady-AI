import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, isErrorResponse } from "@/lib/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const supabase = createServiceRoleClient();
  const targetId = params.id;

  // Get user from auth
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(targetId);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const authUser = authData.user;

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, is_admin, inbound_email_token")
    .eq("id", targetId)
    .single();

  // Get document counts
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: allDocs } = await supabase
    .from("documents")
    .select("id, created_at")
    .eq("user_id", targetId);

  const docsTotal = allDocs?.length || 0;
  const docsMonth = allDocs?.filter((d) => d.created_at >= startOfMonth).length || 0;
  const lastDocAt = allDocs?.reduce((latest: string | null, d) => {
    if (!latest || d.created_at > latest) return d.created_at;
    return latest;
  }, null) || null;

  // Get recent documents
  const { data: recentDocs } = await supabase
    .from("documents")
    .select("id, file_name, status, source, created_at, extraction_duration_ms, error_message")
    .eq("user_id", targetId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Get integrations
  const { data: fakturoidCheck } = await supabase
    .from("user_integrations")
    .select("provider")
    .eq("user_id", targetId)
    .eq("provider", "fakturoid")
    .single();

  return NextResponse.json({
    user: {
      id: authUser.id,
      email: authUser.email || "",
      created_at: authUser.created_at,
      subscription_tier: profile?.subscription_tier || "free",
      is_admin: profile?.is_admin || false,
      documents_total: docsTotal,
      documents_this_month: docsMonth,
      last_document_at: lastDocAt,
      has_fakturoid: !!fakturoidCheck,
      inbound_email_token: profile?.inbound_email_token || "",
    },
    recent_documents: recentDocs || [],
    integrations: [
      { provider: "fakturoid", configured: !!fakturoidCheck },
    ],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const supabase = createServiceRoleClient();
  const targetId = params.id;

  let body: { subscription_tier?: string; is_admin?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.subscription_tier !== undefined) {
    if (!["free", "basic", "pro"].includes(body.subscription_tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    updates.subscription_tier = body.subscription_tier;
  }
  if (body.is_admin !== undefined) {
    updates.is_admin = body.is_admin;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", targetId);

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
