import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Verify the current user is an admin. Returns the user ID if admin,
 * or a NextResponse error if not.
 */
export async function requireAdmin(): Promise<
  { userId: string } | NextResponse
> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id };
}

export function isErrorResponse(
  result: { userId: string } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
