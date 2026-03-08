import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isErrorResponse } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const userId = url.searchParams.get("user_id") || "";

  const supabase = auth.adminClient;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("extraction_logs")
    .select("*, documents(file_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: logs, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }

  return NextResponse.json({
    logs: logs || [],
    total: count || 0,
    page,
    limit,
  });
}
