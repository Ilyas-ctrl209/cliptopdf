import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "home")
    .maybeSingle();

  return NextResponse.json({ settings: data?.value ?? {} });
}
