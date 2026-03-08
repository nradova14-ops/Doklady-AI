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

interface ResendWebhookPayload {
  type: string;
  data: {
    id?: string;
    email_id?: string;
    from: string;
    to: string[];
    subject: string;
    [key: string]: unknown;
  };
}

interface ResendAttachmentMeta {
  id: string;
  filename: string;
  content_type: string;
}

export async function POST(request: NextRequest) {
  console.log("[inbound-email] Webhook received");

  // Verify webhook - accept if Svix signature headers are present (Resend uses Svix)
  // or fall back to query param secret for simple setups
  const svixId = request.headers.get("svix-id");
  const querySecret = new URL(request.url).searchParams.get("secret");

  if (!svixId && querySecret !== process.env.RESEND_WEBHOOK_SECRET) {
    console.error("[inbound-email] Auth failed - no svix headers and no valid secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: ResendWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    console.error("[inbound-email] Failed to parse JSON payload");
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  console.log("[inbound-email] Payload type:", payload.type, "data keys:", Object.keys(payload.data || {}));

  // Only handle email.received events
  if (payload.type !== "email.received") {
    console.log("[inbound-email] Ignoring event type:", payload.type);
    return NextResponse.json({ ok: true });
  }

  // Resend uses "id" for the email identifier
  const email_id = payload.data.email_id || payload.data.id;
  const { to } = payload.data;
  const toAddress = Array.isArray(to) ? to[0] : to;
  console.log("[inbound-email] email_id:", email_id, "to:", toAddress);
  if (!toAddress) {
    console.error("[inbound-email] No recipient in payload");
    return NextResponse.json({ error: "No recipient" }, { status: 400 });
  }

  // Parse token from {token}@doklady.fun or {token}@ostuete.resend.app
  const [token, domain] = toAddress.split("@");
  const ALLOWED_DOMAINS = ["doklady.fun", "ostuete.resend.app"];
  if (!ALLOWED_DOMAINS.includes(domain)) {
    console.error("[inbound-email] Invalid domain:", domain);
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

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
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Fetch attachment list from Resend API
  const attachmentsRes = await fetch(
    `https://api.resend.com/emails/${email_id}/attachments`,
    { headers: { Authorization: `Bearer ${resendApiKey}` } }
  );

  if (!attachmentsRes.ok) {
    console.error("Failed to fetch attachments:", attachmentsRes.status);
    return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 502 });
  }

  const { data: attachmentList } = (await attachmentsRes.json()) as {
    data: ResendAttachmentMeta[];
  };

  if (!attachmentList || attachmentList.length === 0) {
    console.log("[inbound-email] No attachments found for email:", email_id);
    return NextResponse.json({ success: true, processed: 0 });
  }

  console.log("[inbound-email] Found", attachmentList.length, "attachments");

  // Filter to allowed types
  const validAttachments = attachmentList.filter((att) =>
    ALLOWED_CONTENT_TYPES.includes(att.content_type.toLowerCase())
  );

  if (validAttachments.length === 0) {
    console.log("[inbound-email] No valid attachments (allowed types:", ALLOWED_CONTENT_TYPES.join(", "), ")");
    return NextResponse.json({ success: true, processed: 0 });
  }

  let processedCount = 0;

  for (const attachment of validAttachments) {
    try {
      // Download attachment content from Resend API
      const contentRes = await fetch(
        `https://api.resend.com/emails/${email_id}/attachments/${attachment.id}`,
        { headers: { Authorization: `Bearer ${resendApiKey}` } }
      );

      if (!contentRes.ok) {
        console.error("Failed to download attachment:", attachment.filename, contentRes.status);
        continue;
      }

      const { content } = (await contentRes.json()) as { content: string };
      const buffer = Buffer.from(content, "base64");

      const documentId = crypto.randomUUID();
      const fileType = attachment.content_type === "application/pdf" ? "pdf" : "image";
      const filename = attachment.filename || `attachment-${documentId}.${fileType === "pdf" ? "pdf" : "jpg"}`;
      const storagePath = `${userId}/${documentId}/${filename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType: attachment.content_type,
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
        source: "email",
      });

      if (dbError) {
        console.error("DB error for", filename, dbError.message);
        await supabase.storage.from("documents").remove([storagePath]);
        continue;
      }

      // Run extraction via Claude API
      try {
        await extractDocument(supabase, documentId, userId, storagePath, fileType, filename);
      } catch (extractErr) {
        console.error("Extraction error for", filename, extractErr);
        await supabase
          .from("documents")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", documentId);
      }

      processedCount++;
    } catch (err) {
      console.error("Error processing attachment:", attachment.filename, err);
    }
  }

  console.log("[inbound-email] Done. Processed:", processedCount, "of", validAttachments.length);
  return NextResponse.json({ success: true, processed: processedCount });
}

async function extractDocument(
  supabase: ReturnType<typeof createAdminClient>,
  documentId: string,
  userId: string,
  fileUrl: string,
  fileType: string,
  fileName: string
) {
  const startTime = Date.now();
  const model = "claude-sonnet-4-20250514";

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
    model,
    max_tokens: 4096,
    system: EXTRACTION_PROMPT,
    messages: [{ role: "user", content }],
  });

  const durationMs = Date.now() - startTime;

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
      extraction_duration_ms: durationMs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  // Log extraction with token usage
  const usage = response.usage;
  await supabase.from("extraction_logs").insert({
    document_id: documentId,
    user_id: userId,
    status: "success",
    model,
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    cache_read_tokens: (usage as unknown as Record<string, number>).cache_read_input_tokens || 0,
    cache_creation_tokens: (usage as unknown as Record<string, number>).cache_creation_input_tokens || 0,
    duration_ms: durationMs,
  });
}
