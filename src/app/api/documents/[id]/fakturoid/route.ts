import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const apiToken = process.env.FAKTUROID_API_TOKEN;
  const accountSlug = process.env.FAKTUROID_ACCOUNT_SLUG;

  if (!apiToken || !accountSlug) {
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
  const expensePayload: Record<string, unknown> = {
    supplier_name: data.supplier?.name || null,
    supplier_registration_no: data.supplier?.ico || null,
    supplier_vat_no: data.supplier?.dic || null,
    supplier_street: data.supplier?.address || null,
    original_number: data.invoice_number || null,
    variable_symbol: data.variable_symbol || null,
    issued_on: data.issue_date || null,
    due_on: data.due_date || null,
    currency: data.currency || "CZK",
    lines,
  };

  // Remove null values to avoid API validation issues
  for (const key of Object.keys(expensePayload)) {
    if (expensePayload[key] === null) {
      delete expensePayload[key];
    }
  }

  try {
    const response = await fetch(
      `https://app.fakturoid.cz/api/v3/accounts/${accountSlug}/expenses.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "DokladyAI (support@doklady.ai)",
        },
        body: JSON.stringify(expensePayload),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Fakturoid API error:", response.status, errorBody);
      return NextResponse.json(
        {
          error: "Fakturoid API request failed",
          status: response.status,
          details: errorBody,
        },
        { status: response.status }
      );
    }

    const expense = await response.json();

    return NextResponse.json({
      success: true,
      expense_id: expense.id,
      expense_url: `https://app.fakturoid.cz/${accountSlug}/expenses/${expense.id}`,
    });
  } catch (err) {
    console.error("Fakturoid send error:", err);
    return NextResponse.json(
      { error: "Failed to send to Fakturoid" },
      { status: 500 }
    );
  }
}
