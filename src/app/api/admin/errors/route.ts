import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, isErrorResponse } from "@/lib/admin";

export async function GET() {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const supabase = createServiceRoleClient();

  // Get error documents with user info
  const { data: errorDocs } = await supabase
    .from("documents")
    .select("id, user_id, file_name, error_message, created_at, source")
    .eq("status", "error")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!errorDocs || errorDocs.length === 0) {
    return NextResponse.json({ errors: [] });
  }

  // Get user emails
  const userIds = Array.from(new Set(errorDocs.map((d) => d.user_id)));
  const emailMap = new Map<string, string>();

  for (const uid of userIds) {
    const { data } = await supabase.auth.admin.getUserById(uid);
    if (data?.user?.email) {
      emailMap.set(uid, data.user.email);
    }
  }

  const errors = errorDocs.map((d) => ({
    id: d.id,
    user_email: emailMap.get(d.user_id) || d.user_id,
    file_name: d.file_name,
    error_message: d.error_message,
    created_at: d.created_at,
    source: d.source || "upload",
  }));

  return NextResponse.json({ errors });
}
