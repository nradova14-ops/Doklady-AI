import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try to get existing profile, or create one for pre-migration users
  const { data: existing } = await supabase
    .from("profiles")
    .select("inbound_email_token")
    .eq("id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({
      inbound_email_token: existing.inbound_email_token,
      inbound_email: `${existing.inbound_email_token}@doklady.fun`,
    });
  }

  // Profile doesn't exist yet — create one
  const { data: newProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id })
    .select("inbound_email_token")
    .single();

  if (insertError || !newProfile) {
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    inbound_email_token: newProfile.inbound_email_token,
    inbound_email: `${newProfile.inbound_email_token}@doklady.fun`,
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.action !== "regenerate_token") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Generate a new random token using Supabase's gen_random_bytes via RPC,
  // or generate it in JS and update.
  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ inbound_email_token: newToken })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to regenerate token" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    inbound_email_token: newToken,
    inbound_email: `${newToken}@doklady.fun`,
  });
}
