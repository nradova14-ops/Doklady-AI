import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateMoneyS3Xml, encodeToWindows1250 } from "@/lib/money-s3";
import type { ExportType } from "@/lib/money-s3";

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

  const xmlString = generateMoneyS3Xml(documents, type);
  const xmlBuffer = encodeToWindows1250(xmlString);

  const today = new Date().toISOString().split("T")[0];
  const filename = `money-s3-export-${today}.xml`;

  return new NextResponse(new Uint8Array(xmlBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=windows-1250",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
