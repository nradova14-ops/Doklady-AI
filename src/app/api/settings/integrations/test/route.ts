import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider } = body;

  if (provider !== "fakturoid") {
    return NextResponse.json(
      { error: "Unsupported provider" },
      { status: 400 }
    );
  }

  const { data: integration, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "fakturoid")
    .single();

  if (error || !integration) {
    return NextResponse.json(
      { success: false, error: "Integrace není nakonfigurována." },
      { status: 404 }
    );
  }

  try {
    const clientSecret = decrypt(integration.client_secret_encrypted);

    const response = await fetch(
      "https://app.fakturoid.cz/api/v3/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization:
            "Basic " +
            Buffer.from(integration.client_id + ":" + clientSecret).toString(
              "base64"
            ),
          "User-Agent": "DokladyAI (support@doklady.ai)",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({
        success: false,
        error: `Fakturoid vrátil chybu (${response.status}): ${text}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznámá chyba";
    return NextResponse.json({ success: false, error: message });
  }
}
