import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
];

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
- total_amount: celková částka včetně DPH — VŽDY čti přímo z řádku "Celkem" nebo "Celkem k úhradě" v souhrnné tabulce faktury. NIKDY nepočítej součet položek.
- currency: měna (výchozí CZK)
- vat_base: základ daně (číslo, může být záporné)
- vat_amount: výše DPH (číslo, může být záporné)
- vat_rate: sazba DPH v % (číslo)
- bank_account: číslo účtu ve formátu XXXXXXXXX/XXXX
- variable_symbol: variabilní symbol
- items: pole položek [{ description, quantity, unit_price, total }]
- notes: ostatní relevantní poznámky

DŮLEŽITÉ pravidlo pro záporné částky:
- Pokud je na dokladu uvedena záporná hodnota, ZACHOVEJ záporné znaménko.
- Dobropisy a storna typicky obsahují záporné částky — je to správné chování.`;

interface ResendAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
}

interface ResendInboundPayload {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: ResendAttachment[];
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: ResendInboundPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Extract token from to address
  const toAddress = payload.to?.[0];
  if (!toAddress) {
    return NextResponse.json({ error: "No recipient" }, { status: 400 });
  }

  const match = toAddress.match(/^([^@]+)@in\.doklady\.fun$/i);
  if (!match) {
    return NextResponse.json({ error: "Invalid recipient domain" }, { status: 400 });
  }
  const token = match[1];

  // Find user by token
  const supabase = createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("inbound_email_token", token)
    .single();

  if (profileError || !profile) {
    console.error("Unknown inbound token:", token);
    return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  }

  const userId = profile.id;

  // Filter valid attachments
  const attachments = (payload.attachments || []).filter((att) =>
    ALLOWED_CONTENT_TYPES.includes(att.contentType.toLowerCase())
  );

  if (attachments.length === 0) {
    // No processable attachments — silently accept to avoid Resend retries
    return NextResponse.json({ success: true, processed: 0 });
  }

  const processed: string[] = [];

  for (const attachment of attachments) {
    try {
      const documentId = crypto.randomUUID();
      const fileType = attachment.contentType === "application/pdf" ? "pdf" : "image";
      const filename = attachment.filename || `attachment-${documentId}.${fileType === "pdf" ? "pdf" : "jpg"}`;
      const storagePath = `${userId}/${documentId}/${filename}`;

      // Decode base64 attachment
      const buffer = Buffer.from(attachment.content, "base64");

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType: attachment.contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error for", filename, uploadError.message);
        continue;
      }

      // Create document record
      const { error: dbError } = await supabase.from("documents").insert({
        id: documentId,
        user_id: userId,
        file_url: storagePath,
        file_name: filename,
        file_type: fileType,
        status: "processing",
      });

      if (dbError) {
        console.error("DB error for", filename, dbError.message);
        await supabase.storage.from("documents").remove([storagePath]);
        continue;
      }

      // Run extraction via Claude API
      try {
        await extractDocument(supabase, documentId, storagePath, fileType, filename);
      } catch (extractErr) {
        console.error("Extraction error for", filename, extractErr);
        await supabase
          .from("documents")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", documentId);
      }

      processed.push(documentId);
    } catch (err) {
      console.error("Error processing attachment:", attachment.filename, err);
    }
  }

  return NextResponse.json({ success: true, processed: processed.length });
}

async function extractDocument(
  supabase: ReturnType<typeof createAdminClient>,
  documentId: string,
  fileUrl: string,
  fileType: string,
  fileName: string
) {
  // Download file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("documents")
    .download(fileUrl);

  if (downloadError || !fileData) {
    throw new Error("Failed to download file for extraction");
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const base64 = buffer.toString("base64");

  // Determine media type
  let mediaType: "application/pdf" | "image/jpeg" | "image/png";
  if (fileType === "pdf") {
    mediaType = "application/pdf";
  } else {
    mediaType = fileName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const content: Anthropic.ContentBlockParam[] = [];

  if (fileType === "pdf") {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    });
  } else {
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png", data: base64 },
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
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in Claude response");
  }

  let jsonStr = textBlock.text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const extractedData = JSON.parse(jsonStr);

  await supabase
    .from("documents")
    .update({
      extracted_data: extractedData,
      status: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
}
