import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_integrations")
    .select("provider, slug, client_id, created_at, updated_at")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const integrations = (data || []).map((row) => ({
    provider: row.provider,
    slug: row.slug,
    client_id: row.client_id,
    is_configured: true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return NextResponse.json({ integrations });
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, slug, client_id, client_secret } = body;

  if (!provider || !slug || !client_id || !client_secret) {
    return NextResponse.json(
      { error: "Všechna pole jsou povinná." },
      { status: 400 }
    );
  }

  const encryptedSecret = encrypt(client_secret);

  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: user.id,
      provider,
      slug,
      client_id,
      client_secret_encrypted: encryptedSecret,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json(
      { error: "Provider is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
