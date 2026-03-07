import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateIsdocXml, filterDocuments } from "@/lib/isdoc";
import type { ExportType } from "@/lib/isdoc";
import archiver from "archiver";
import { PassThrough } from "stream";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { document_ids: string[]; type: ExportType };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { document_ids, type = "all" } = body;

  if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
    return NextResponse.json(
      { error: "No documents selected" },
      { status: 400 }
    );
  }

  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .in("id", document_ids)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load documents" },
      { status: 500 }
    );
  }

  if (!documents || documents.length === 0) {
    return NextResponse.json(
      { error: "No documents found" },
      { status: 404 }
    );
  }

  const filtered = filterDocuments(documents, type);

  if (filtered.length === 0) {
    return NextResponse.json(
      { error: "Žádné dokumenty odpovídající filtru" },
      { status: 404 }
    );
  }

  const today = new Date().toISOString().split("T")[0];

  // Single document — return .isdoc XML directly
  if (filtered.length === 1) {
    const xml = generateIsdocXml(filtered[0]);
    if (!xml) {
      return NextResponse.json(
        { error: "Document has no extracted data" },
        { status: 400 }
      );
    }
    const invoiceNum = filtered[0].extracted_data?.invoice_number || "doklad";
    const safeNum = invoiceNum.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeNum}.isdoc`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // Multiple documents — return a ZIP containing individual .isdoc files
  const archive = archiver("zip", { zlib: { level: 9 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  for (const doc of filtered) {
    const xml = generateIsdocXml(doc);
    if (!xml) continue;
    const invoiceNum = doc.extracted_data?.invoice_number || doc.id.slice(0, 8);
    const safeNum = invoiceNum.replace(/[^a-zA-Z0-9_-]/g, "_");
    archive.append(xml, { name: `${safeNum}.isdoc` });
  }

  await archive.finalize();

  // Collect the ZIP into a buffer
  const chunks: Buffer[] = [];
  for await (const chunk of passthrough) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const zipBuffer = Buffer.concat(chunks);

  const filename = `isdoc-export-${today}.zip`;

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
