import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { lookupIco } from "@/lib/ares";

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
- total_amount: celková částka včetně DPH — VŽDY čti přímo z řádku "Celkem" nebo "Celkem k úhradě" v souhrnné tabulce faktury. NIKDY nepočítej součet položek. Řádek "Zaokrouhlení" je součástí celkové částky — ignoruj ho jako samostatnou hodnotu, ale výsledný "Celkem" už zaokrouhlení obsahuje.
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
- items[].quantity musí být hodnota ze sloupce 'ks' (počet kusů k objednání/dodání).
- Faktury od pivních/vinařských dodavatelů mají sloupce v pořadí: %EPM | Objem | ks | Základní cena | Sleva | ...
  - Sloupec '%EPM' obsahuje čísla jako 14, 12, 11 (stupně alkoholu) — IGNORUJ, toto NENÍ quantity.
  - Sloupec 'Objem' obsahuje hodnoty jako 1l, 0.75l (objem lahve) — IGNORUJ, toto NENÍ quantity.
  - Sloupec 'ks' obsahuje celá čísla jako 6, 5, 3 (počty kusů) — TOTO JE quantity.
- Příklad: Bombardér 14 IPA → %EPM=14, Objem=1l, ks=6 → quantity musí být 6 (ne 14, ne 1).
- Příklad: Tryskáč APA → %EPM=12, Objem=0.75l, ks=5 → quantity musí být 5 (ne 12, ne 0.75).
- Pro pole items[].quantity VŽDY přečti přesnou číselnou hodnotu ze sloupce 'ks'/'počet kusů'/'množství'. Nikdy nepoužívej 1 jako výchozí hodnotu pokud na faktuře je uvedeno jiné číslo.
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

  let startTime = Date.now();

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

    startTime = Date.now();
    const model = "claude-sonnet-4-20250514";

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content,
        },
      ],
    });

    const durationMs = Date.now() - startTime;

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

    // Enrich supplier data from ARES if IČO is available
    if (extractedData.supplier?.ico) {
      try {
        const aresData = await lookupIco(extractedData.supplier.ico);
        if (aresData) {
          if (!extractedData.supplier.name && aresData.name)
            extractedData.supplier.name = aresData.name;
          if (!extractedData.supplier.dic && aresData.dic)
            extractedData.supplier.dic = aresData.dic;
          if (!extractedData.supplier.address && aresData.address)
            extractedData.supplier.address = aresData.address;
        }
      } catch {
        // ARES lookup failure should not block extraction
      }
    }

    // Update document
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        extracted_data: extractedData,
        status: "done",
        extraction_duration_ms: durationMs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (updateError) {
      throw new Error("Failed to update document");
    }

    // Log extraction with token usage
    const adminClient = createAdminClient();
    const usage = response.usage;
    await adminClient.from("extraction_logs").insert({
      document_id: params.id,
      user_id: user.id,
      status: "success",
      model,
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_read_tokens: (usage as unknown as Record<string, number>).cache_read_input_tokens || 0,
      cache_creation_tokens: (usage as unknown as Record<string, number>).cache_creation_input_tokens || 0,
      duration_ms: durationMs,
    });

    return NextResponse.json({ extracted_data: extractedData });
  } catch (err) {
    console.error("Extraction error:", err);

    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    // Set status to error
    await supabase
      .from("documents")
      .update({
        status: "error",
        error_message: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    // Log failed extraction
    try {
      const adminClient = createAdminClient();
      await adminClient.from("extraction_logs").insert({
        document_id: params.id,
        user_id: user.id,
        status: "error",
        model: "claude-sonnet-4-20250514",
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - startTime,
        error_message: errorMsg,
      });
    } catch {
      // Don't fail the request if logging fails
    }

    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 }
    );
  }
}
