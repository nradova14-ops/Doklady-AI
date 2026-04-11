import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendToIdoklad } from "@/lib/idoklad";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load document with extracted data
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!doc.extracted_data) {
    return NextResponse.json(
      { error: "No extracted data available" },
      { status: 400 }
    );
  }

  // Load user profile to check VAT payer status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_vat_payer")
    .eq("id", user.id)
    .single();

  try {
    const result = await sendToIdoklad(user.id, doc.extracted_data, {
      isVatPayer: profile?.is_vat_payer ?? false,
    });

    // Save sync info to document
    await supabase
      .from("documents")
      .update({
        idoklad_invoice_id: result.invoiceId,
        idoklad_invoice_number: result.invoiceNumber,
        idoklad_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    return NextResponse.json({
      success: true,
      invoiceId: result.invoiceId,
      invoiceNumber: result.invoiceNumber,
    });
  } catch (err) {
    console.error("[iDoklad] Send error:", err);
    const message = err instanceof Error ? err.message : "Neznámá chyba";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
