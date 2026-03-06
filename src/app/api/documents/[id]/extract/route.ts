import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const EXTRACTION_PROMPT = `Jsi expert na vytěžování dat z českých účetních dokladů.
Dostaneš obrázek nebo PDF faktury, účtenky nebo jiného dokladu.
Tvým úkolem je vytěžit všechna relevantní data a vrátit je POUZE jako validní JSON objekt.
Nepiš žádný text před ani za JSON. Pouze samotný JSON.

Vytěž tato pole (pokud nejsou na dokladu, nastav null):
- document_type: typ dokladu (faktura/účtenka/zálohová faktura/dobropis)
- supplier: { name, ico, dic, address }
- customer: { name, ico, dic, address }
- invoice_number: číslo dokladu
- issue_date: datum vystavení (formát YYYY-MM-DD)
- due_date: datum splatnosti (formát YYYY-MM-DD)
- total_amount: celková částka včetně DPH (číslo, může být záporné u dobropisů)
- currency: měna (výchozí CZK)
- vat_base: základ daně (číslo, může být záporné)
- vat_amount: výše DPH (číslo, může být záporné)
- vat_rate: sazba DPH v % (číslo)
- bank_account: číslo účtu ve formátu XXXXXXXXX/XXXX
- variable_symbol: variabilní symbol
- items: pole položek [{ description, quantity, unit_price, total }]
- notes: ostatní relevantní poznámky

DŮLEŽITÉ pravidlo pro záporné částky:
- Pokud je na dokladu uvedena záporná hodnota (např. -24.79, −100.00), ZACHOVEJ záporné znaménko.
- Pole unit_price a total u položek (items) MOHOU být záporná čísla. Neměň je na kladné.
- Totéž platí pro total_amount, vat_base a vat_amount — pokud jsou na dokladu záporné, vrať je jako záporné.
- Dobropisy a storna typicky obsahují záporné částky — je to správné chování, neupravuj znaménko.

DŮLEŽITÉ pravidlo pro quantity u položek (items):
- items[].quantity je VŽDY hodnota ze sloupce 'ks' nebo 'počet kusů' nebo 'množství v kusech'. Nikdy nepoužívej hodnotu ze sloupce 'Objem' (l, ml, cl) ani '%EPM' ani jiné jednotky.
- Hledej sloupec který obsahuje celá čísla jako 12, 14, 11 — to jsou kusy.
- Příklad z faktury: Bombardér 14 IPA → ks=12, objem=1l → quantity musí být 12, ne 1.
- Objem lahve (0.75l, 1l, 75cl apod.) NENÍ quantity. Objem patří do popisu položky (description).
- Pro pole items[].quantity VŽDY přečti přesnou číselnou hodnotu z faktury. Nikdy nepoužívej 1 jako výchozí hodnotu pokud na faktuře je uvedeno jiné číslo.
- Pouze pokud počet kusů skutečně NENÍ na dokladu uveden a nelze ho odvodit, nastav quantity na 1.`;

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

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.file_url);

    if (downloadError || !fileData) {
      throw new Error("Failed to download file");
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString("base64");

    // Determine media type
    let mediaType: "application/pdf" | "image/jpeg" | "image/png";
    if (doc.file_type === "pdf") {
      mediaType = "application/pdf";
    } else {
      const ext = doc.file_name.toLowerCase();
      mediaType = ext.endsWith(".png") ? "image/png" : "image/jpeg";
    }

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const content: Anthropic.ContentBlockParam[] = [];

    if (doc.file_type === "pdf") {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      });
    } else {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/jpeg" | "image/png",
          data: base64,
        },
      });
    }

    content.push({
      type: "text",
      text: "Vytěž data z tohoto dokladu podle instrukcí.",
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content,
        },
      ],
    });

    // Parse response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in Claude response");
    }

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const extractedData = JSON.parse(jsonStr);

    // Update document
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        extracted_data: extractedData,
        status: "done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (updateError) {
      throw new Error("Failed to update document");
    }

    return NextResponse.json({ extracted_data: extractedData });
  } catch (err) {
    console.error("Extraction error:", err);

    // Set status to error
    await supabase
      .from("documents")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 }
    );
  }
}
