import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getFakturoidAccessToken,
  findSubjectByIco,
  createSubject,
} from "@/lib/fakturoid";

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

  const accountSlug = process.env.FAKTUROID_ACCOUNT_SLUG;

  if (!accountSlug) {
    return NextResponse.json(
      { error: "Fakturoid API is not configured" },
      { status: 500 }
    );
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

  const data = doc.extracted_data;

  // Build expense lines from extracted items
  const lines = (data.items || []).map(
    (item: { description: string | null; quantity: number | null; unit_price: number | null }) => ({
      name: item.description || "Položka",
      quantity: item.quantity?.toString() || "1",
      unit_price: item.unit_price?.toString() || "0",
      vat_rate: data.vat_rate?.toString() || "21",
    })
  );

  // If no line items, create a single line from totals
  if (lines.length === 0 && data.total_amount != null) {
    lines.push({
      name: data.document_type || "Položka",
      quantity: "1",
      unit_price: (data.vat_base ?? data.total_amount)?.toString() || "0",
      vat_rate: data.vat_rate?.toString() || "21",
    });
  }

  // Build the expense payload
  // supplier_name is required by Fakturoid API — always include it
  const expensePayload: Record<string, unknown> = {
    supplier_name: data.supplier?.name || "Neznámý dodavatel",
    currency: data.currency || "CZK",
    lines,
  };

  // Optional fields — only include if present
  if (data.supplier?.ico) expensePayload.supplier_registration_no = data.supplier.ico;
  if (data.supplier?.dic) expensePayload.supplier_vat_no = data.supplier.dic;
  if (data.supplier?.address) expensePayload.supplier_street = data.supplier.address;
  if (data.invoice_number) expensePayload.original_number = data.invoice_number;
  if (data.variable_symbol) expensePayload.variable_symbol = data.variable_symbol;
  if (data.issue_date) expensePayload.issued_on = data.issue_date;
  if (data.due_date) expensePayload.due_on = data.due_date;

  try {
    // 1. Find or create subject (contact) in Fakturoid
    const supplierName = data.supplier?.name || "Neznámý dodavatel";
    const supplierIco = data.supplier?.ico;

    let subjectId: number | null = null;

    if (supplierIco) {
      const existing = await findSubjectByIco(accountSlug, supplierIco);
      if (existing) {
        subjectId = existing.id;
        console.log("[Fakturoid] Found existing subject:", subjectId);
      }
    }

    if (!subjectId) {
      const created = await createSubject(accountSlug, {
        name: supplierName,
        registration_no: supplierIco || undefined,
        vat_no: data.supplier?.dic || undefined,
        street: data.supplier?.address || undefined,
      });
      subjectId = created.id;
      console.log("[Fakturoid] Created new subject:", subjectId);
    }

    // 2. Add subject_id to expense payload
    expensePayload.subject_id = subjectId;

    // Obtain OAuth access token via Client Credentials flow
    const accessToken = await getFakturoidAccessToken();

    console.log("[Fakturoid] Expense payload:", JSON.stringify(expensePayload, null, 2));

    const response = await fetch(
      `https://app.fakturoid.cz/api/v3/accounts/${accountSlug}/expenses.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "DokladyAI (support@doklady.ai)",
        },
        body: JSON.stringify(expensePayload),
      }
    );

    const responseBody = await response.text();
    console.log("[Fakturoid] Expenses API status:", response.status);
    console.log("[Fakturoid] Expenses API response:", responseBody);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Fakturoid API request failed",
          status: response.status,
          details: responseBody,
        },
        { status: response.status }
      );
    }

    const expense = JSON.parse(responseBody);

    return NextResponse.json({
      success: true,
      expense_id: expense.id,
      expense_url: `https://app.fakturoid.cz/${accountSlug}/expenses/${expense.id}`,
    });
  } catch (err) {
    console.error("[Fakturoid] Send error:", err);
    return NextResponse.json(
      { error: "Failed to send to Fakturoid" },
      { status: 500 }
    );
  }
}
