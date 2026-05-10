import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!isAdminPassword(request, String(body.password ?? ""))) {
    return NextResponse.json({ error: "Wrong admin password." }, { status: 401 });
  }
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "PDF id is required." }, { status: 400 });

  const { error } = await supabaseAdmin.from("pdfs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
