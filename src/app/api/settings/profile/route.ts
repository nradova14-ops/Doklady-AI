import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PROFILE_FIELDS = [
  "company_name",
  "ico",
  "dic",
  "address",
  "city",
  "zip",
  "is_vat_payer",
  "accounting_software",
] as const;

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
    .select(
      "inbound_email_token, company_name, ico, dic, address, city, zip, is_vat_payer, accounting_software"
    )
    .eq("id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({
      inbound_email_token: existing.inbound_email_token,
      inbound_email: `${existing.inbound_email_token}@doklady.fun`,
      company_name: existing.company_name || "",
      ico: existing.ico || "",
      dic: existing.dic || "",
      address: existing.address || "",
      city: existing.city || "",
      zip: existing.zip || "",
      is_vat_payer: existing.is_vat_payer || false,
      accounting_software: existing.accounting_software || "none",
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
    company_name: "",
    ico: "",
    dic: "",
    address: "",
    city: "",
    zip: "",
    is_vat_payer: false,
    accounting_software: "none",
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

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Only allow known company fields
  const updates: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
