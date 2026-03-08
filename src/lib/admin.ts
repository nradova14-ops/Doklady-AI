import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Verify the current user is an admin. Returns the user ID and an
 * admin supabase client (service role, bypasses RLS) if admin,
 * or a NextResponse error if not.
 */
export async function requireAdmin(): Promise<
  { userId: string; adminClient: ReturnType<typeof createAdminClient> } | NextResponse
> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id, adminClient };
}

export function isErrorResponse(
  result: { userId: string; adminClient: ReturnType<typeof createAdminClient> } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
