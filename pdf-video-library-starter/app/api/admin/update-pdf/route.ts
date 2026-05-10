import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { youtubeThumbnail } from "@/lib/youtube";

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

  const id = String(formData.get("id") ?? "");
  if (!id) return NextResponse.json({ error: "PDF id is required." }, { status: 400 });

  const { data: existing, error: existingError } = await supabaseAdmin.from("pdfs").select("*").eq("id", id).maybeSingle();
  if (existingError || !existing) return NextResponse.json({ error: "PDF not found." }, { status: 404 });

  const requiredPlan = String(formData.get("requiredPlan") ?? "free");
  const normalizedPlan = requiredPlan === "premium" ? "premium" : requiredPlan === "pro" ? "pro" : "free";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pdfs";
  const stamp = Date.now();

  const pageImages = formData.getAll("pageImages").filter((item): item is File => item instanceof File && item.size > 0);
  const pdfFile = formData.get("pdfFile");
  const copyrightImage = formData.get("copyrightImage");

  const updateData: Record<string, unknown> = {
    title: String(formData.get("title") ?? existing.title).trim() || existing.title,
    category: String(formData.get("category") ?? existing.category).trim() || existing.category,
    creator_name: String(formData.get("creatorName") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    required_plan: normalizedPlan,
    is_pro: normalizedPlan !== "free"
  };

  try {
    if (pageImages.length > 0) {
      const pageImageUrls: string[] = [];
      for (let index = 0; index < pageImages.length; index++) {
        const image = pageImages[index];
        if (image.type && !image.type.startsWith("image/")) return NextResponse.json({ error: "Page images must be images." }, { status: 400 });
        const imagePath = `${existing.video_id}/admin-pages/${stamp}-${String(index + 1).padStart(2, "0")}-${safeFileName(image.name)}`;
        pageImageUrls.push(await uploadPublicFile(bucket, imagePath, image));
      }
      updateData.page_image_urls = pageImageUrls;
      updateData.thumbnail_url = pageImageUrls[0] ?? youtubeThumbnail(existing.video_id);
    }

    if (pdfFile instanceof File && pdfFile.size > 0) {
      if (pdfFile.type && pdfFile.type !== "application/pdf") return NextResponse.json({ error: "PDF file must be a PDF." }, { status: 400 });
      updateData.pdf_url = await uploadPublicFile(bucket, `${existing.video_id}/admin-pdf/${stamp}-${safeFileName(pdfFile.name)}`, pdfFile);
    }

    if (copyrightImage instanceof File && copyrightImage.size > 0) {
      if (copyrightImage.type && !copyrightImage.type.startsWith("image/")) return NextResponse.json({ error: "Copyright file must be an image." }, { status: 400 });
      updateData.copyright_image_url = await uploadPublicFile(bucket, `${existing.video_id}/admin-copyright/${stamp}-${safeFileName(copyrightImage.name)}`, copyrightImage);
    }

    const { data, error } = await supabaseAdmin.from("pdfs").update(updateData).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, pdf: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed." }, { status: 500 });
  }
}
