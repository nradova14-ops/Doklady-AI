import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getFakturoidAccessToken,
  getFakturoidCredentials,
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

  // Load per-user Fakturoid credentials (DB or ENV fallback)
  let creds;
  try {
    creds = await getFakturoidCredentials(user.id);
  } catch {
    return NextResponse.json(
      { error: "Fakturoid není nakonfigurován. Přejdi do Nastavení → Integrace." },
      { status: 400 }
    );
  }
  const accountSlug = creds.slug;

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

  // DEBUG: Log supplier vs customer data from extraction
  console.log("[Fakturoid DEBUG] extracted_data.supplier:", JSON.stringify(data.supplier, null, 2));
  console.log("[Fakturoid DEBUG] extracted_data.customer:", JSON.stringify(data.customer, null, 2));
  console.log("[Fakturoid DEBUG] supplier.ico (IČO used for search):", data.supplier?.ico ?? "MISSING");
  console.log("[Fakturoid DEBUG] customer.ico (should NOT be used):", data.customer?.ico ?? "MISSING");

  // Build expense lines from extracted items
  // Fakturoid expects numeric values for quantity and unit_price
  const vatRate = data.vat_rate != null ? Number(data.vat_rate) : 21;
  const lines = (data.items || []).map(
    (item: { description: string | null; quantity: number | null; unit_price: number | null }) => ({
      name: item.description || "Položka",
      quantity: item.quantity != null ? Number(item.quantity) : 1,
      unit_price: item.unit_price != null ? Math.round(Number(item.unit_price) * 100) / 100 : 0,
      vat_rate: vatRate,
    })
  );

  // If no line items, create a single line from totals
  if (lines.length === 0 && data.total_amount != null) {
    lines.push({
      name: data.document_type || "Položka",
      quantity: 1,
      unit_price: Math.round(Number(data.vat_base ?? data.total_amount) * 100) / 100 || 0,
      vat_rate: vatRate,
    });
  }

  // Add rounding adjustment line if extracted total differs from computed total
  // Fakturoid computes total from lines, so we add a "Zaokrouhlení" line at 0% VAT
  if (data.total_amount != null && lines.length > 0) {
    const computedTotal = lines.reduce((sum: number, line: { quantity: number; unit_price: number; vat_rate: number }) => {
      const lineBase = line.quantity * line.unit_price;
      const lineVat = Math.round(lineBase * (line.vat_rate / 100) * 100) / 100;
      return sum + lineBase + lineVat;
    }, 0);
    const invoiceTotal = Number(data.total_amount);
    const roundingDiff = Math.round((invoiceTotal - computedTotal) * 100) / 100;

    if (roundingDiff !== 0 && Math.abs(roundingDiff) < 1) {
      lines.push({
        name: "Zaokrouhlení",
        quantity: 1,
        unit_price: roundingDiff,
        vat_rate: 0,
      });
      console.log("[Fakturoid] Rounding adjustment:", roundingDiff, "Kč (invoice:", invoiceTotal, "computed:", computedTotal, ")");
    }
  }

  // Build the expense payload
  // IMPORTANT: always use data.supplier (dodavatel), NOT data.customer (odběratel)
  const supplier = data.supplier || {};
  const supplierName = supplier.name || "Neznámý dodavatel";

  const expensePayload: Record<string, unknown> = {
    supplier_name: supplierName,
    currency: data.currency || "CZK",
    lines,
  };

  // Optional supplier fields — only include if present
  if (supplier.ico) expensePayload.supplier_registration_no = supplier.ico;
  if (supplier.dic) expensePayload.supplier_vat_no = supplier.dic;
  if (supplier.address) expensePayload.supplier_street = supplier.address;
  if (data.invoice_number) expensePayload.original_number = data.invoice_number;
  if (data.variable_symbol) expensePayload.variable_symbol = data.variable_symbol;
  if (data.issue_date) expensePayload.issued_on = data.issue_date;
  if (data.due_date) expensePayload.due_on = data.due_date;
   // Zaokrouhlení = rozdíl mezi Celkem z faktury a součtem položek
  if (data.total_amount != null) {
    const linesTotal = lines.reduce((sum: number, line: { quantity: number; unit_price: number; vat_rate: number }) => {
      const lineTotal = line.quantity * line.unit_price * (1 + line.vat_rate / 100);
      return sum + Math.round(lineTotal * 100) / 100;
    }, 0);
    const rounding = Math.round((Number(data.total_amount) - linesTotal) * 100) / 100;
    if (rounding !== 0) expensePayload.rounding = rounding;
  }

  try {
    // 1. Find or create subject (contact) in Fakturoid
    // Uses supplier (dodavatel) data, NOT customer (odběratel)
    let subjectId: number | null = null;

    console.log("[Fakturoid DEBUG] === SUBJECT SEARCH START ===");
    console.log("[Fakturoid DEBUG] supplier.ico value:", JSON.stringify(supplier.ico));
    console.log("[Fakturoid DEBUG] supplier.name value:", JSON.stringify(supplier.name));

    if (supplier.ico) {
      console.log("[Fakturoid DEBUG] Searching Fakturoid subjects by IČO:", supplier.ico);
      const existing = await findSubjectByIco(accountSlug, supplier.ico, user.id);
      console.log("[Fakturoid DEBUG] findSubjectByIco result:", JSON.stringify(existing, null, 2));
      if (existing) {
        subjectId = existing.id;
        console.log("[Fakturoid DEBUG] Using EXISTING subject_id:", subjectId);
      }
    } else {
      console.log("[Fakturoid DEBUG] No supplier.ico — skipping search, will create new subject");
    }

    if (!subjectId) {
      console.log("[Fakturoid DEBUG] No subject found — creating new subject with:", JSON.stringify({
        name: supplierName,
        registration_no: supplier.ico || undefined,
        vat_no: supplier.dic || undefined,
        street: supplier.address || undefined,
      }, null, 2));
      const created = await createSubject(accountSlug, {
        name: supplierName,
        registration_no: supplier.ico || undefined,
        vat_no: supplier.dic || undefined,
        street: supplier.address || undefined,
      }, user.id);
      subjectId = created.id;
      console.log("[Fakturoid DEBUG] Created NEW subject_id:", subjectId);
    }

    // 2. Add subject_id to expense payload
    console.log("[Fakturoid DEBUG] === FINAL subject_id:", subjectId, "===");
    expensePayload.subject_id = subjectId;

    // Obtain OAuth access token via Client Credentials flow
    const accessToken = await getFakturoidAccessToken(user.id);

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
