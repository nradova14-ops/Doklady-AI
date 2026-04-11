import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { getIdokladToken, IDOKLAD_API_BASE } from "@/lib/idoklad";

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

  if (provider !== "idoklad") {
    return NextResponse.json(
      { error: "Unsupported provider" },
      { status: 400 }
    );
  }

  const { data: integration, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "idoklad")
    .single();

  if (error || !integration) {
    return NextResponse.json(
      { success: false, error: "Integrace není nakonfigurována." },
      { status: 404 }
    );
  }

  try {
    const clientSecret = decrypt(integration.client_secret_encrypted);
    const token = await getIdokladToken({
      clientId: integration.client_id,
      clientSecret,
    });

    // Fetch company info to verify connection
    let companyName = "";
    try {
      const companyRes = await fetch(
        `${IDOKLAD_API_BASE}/Companies/Default`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );
      if (companyRes.ok) {
        const companyData = await companyRes.json();
        companyName = companyData.CompanyName || "";
      }
    } catch {
      // Company name is nice-to-have, don't fail on it
    }

    return NextResponse.json({ success: true, companyName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznámá chyba";
    return NextResponse.json({ success: false, error: message });
  }
}
