import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function exactCount(table: string) {
  const { count } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function GET(request: Request) {
  if (!isAdminPassword(request)) {
    return NextResponse.json({ error: "Wrong admin password." }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const [pdfCount, userCount, creatorCount, requestCount] = await Promise.all([
    exactCount("pdfs"),
    exactCount("user_profiles"),
    exactCount("creator_profiles"),
    exactCount("pdf_requests")
  ]);

  const { count: viewsToday } = await supabaseAdmin
    .from("user_pdf_views")
    .select("id", { count: "exact", head: true })
    .eq("view_date", today);

  const { count: downloadsToday } = await supabaseAdmin
    .from("user_pdf_downloads")
    .select("id", { count: "exact", head: true })
    .eq("download_date", today);

  const { data: pdfs, error: pdfError } = await supabaseAdmin
    .from("pdfs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (pdfError) return NextResponse.json({ error: pdfError.message }, { status: 500 });

  const { data: users } = await supabaseAdmin
    .from("user_profiles")
    .select("id,user_id,email,display_name,avatar_url,plan,subscription_status,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: settingsRow } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "home")
    .maybeSingle();

  return NextResponse.json({
    stats: { pdfCount, userCount, creatorCount, requestCount, viewsToday: viewsToday ?? 0, downloadsToday: downloadsToday ?? 0 },
    pdfs: pdfs ?? [],
    users: users ?? [],
    settings: settingsRow?.value ?? {}
  });
}
