import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "upload";
}

async function uploadPublicFile(bucket: string, path: string, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
    cacheControl: "3600"
  });
  if (error) throw new Error(error.message);
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  if (!isAdminPassword(request, password)) {
    return NextResponse.json({ error: "Wrong admin password." }, { status: 401 });
  }

  const { data: existing } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "home")
    .maybeSingle();

  const settings: Record<string, unknown> = { ...(existing?.value ?? {}) };
  settings.hero_title = String(formData.get("heroTitle") ?? "").trim() || "Make scrolling feel like reading again.";
  settings.hero_subtitle = String(formData.get("heroSubtitle") ?? "").trim() || "Paste a YouTube link and open the visual PDF version instantly.";

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pdfs";
  const stamp = Date.now();
  const recipeHeroImage = formData.get("recipeHeroImage");
  const animalHeroImage = formData.get("animalHeroImage");

  try {
    if (recipeHeroImage instanceof File && recipeHeroImage.size > 0) {
      if (recipeHeroImage.type && !recipeHeroImage.type.startsWith("image/")) return NextResponse.json({ error: "Recipe hero must be an image." }, { status: 400 });
      settings.recipe_hero_image_url = await uploadPublicFile(bucket, `site/recipe-${stamp}-${safeFileName(recipeHeroImage.name)}`, recipeHeroImage);
    }
    if (animalHeroImage instanceof File && animalHeroImage.size > 0) {
      if (animalHeroImage.type && !animalHeroImage.type.startsWith("image/")) return NextResponse.json({ error: "Animal hero must be an image." }, { status: 400 });
      settings.animal_hero_image_url = await uploadPublicFile(bucket, `site/animal-${stamp}-${safeFileName(animalHeroImage.name)}`, animalHeroImage);
    }

    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "home", value: settings }, { onConflict: "key" })
      .select("value")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, settings: data.value });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save homepage settings." }, { status: 500 });
  }
}
