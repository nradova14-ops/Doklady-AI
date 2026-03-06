import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, JPG, or PNG." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum is 10 MB." },
      { status: 400 }
    );
  }

  const documentId = crypto.randomUUID();
  const fileType = file.type === "application/pdf" ? "pdf" : "image";
  const storagePath = `${user.id}/${documentId}/${file.name}`;

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload file: " + uploadError.message },
      { status: 500 }
    );
  }

  // Create database record
  const { error: dbError } = await supabase.from("documents").insert({
    id: documentId,
    user_id: user.id,
    file_url: storagePath,
    file_name: file.name,
    file_type: fileType,
    status: "processing",
  });

  if (dbError) {
    // Clean up uploaded file on DB error
    await supabase.storage.from("documents").remove([storagePath]);
    return NextResponse.json(
      { error: "Failed to create record: " + dbError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ document_id: documentId });
}
