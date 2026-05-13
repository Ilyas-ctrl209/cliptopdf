import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "category";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "");
  if (!isAdminPassword(request, password)) {
    return NextResponse.json({ error: "Wrong admin password." }, { status: 401 });
  }

  const action = String(body.action ?? "add");

  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "Category id is required." }, { status: 400 });
    const { error } = await supabaseAdmin.from("categories").update({ is_active: false }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const label = String(body.label ?? "").trim();
    const customSlug = String(body.slug ?? "").trim();
    if (!label) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    const slug = slugify(customSlug || label);
    const { error } = await supabaseAdmin
      .from("categories")
      .upsert({ slug, label, is_active: true }, { onConflict: "slug" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data, error: listError } = await supabaseAdmin
    .from("categories")
    .select("id,slug,label,created_at")
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  return NextResponse.json({ ok: true, categories: data ?? [] });
}
