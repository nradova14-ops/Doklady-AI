import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { lookupIco, normalizeIco } from "@/lib/ares";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ico = request.nextUrl.searchParams.get("ico");

  if (!ico || !normalizeIco(ico)) {
    return NextResponse.json(
      { error: "Neplatné IČO. Zadejte 6-8 číslic." },
      { status: 400 }
    );
  }

  const result = await lookupIco(ico);

  if (!result) {
    return NextResponse.json(
      { error: "IČO nenalezeno v ARES." },
      { status: 404 }
    );
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
