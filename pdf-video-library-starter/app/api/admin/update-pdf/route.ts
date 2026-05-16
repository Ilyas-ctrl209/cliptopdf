import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractYouTubeVideoId, youtubeThumbnail } from "@/lib/youtube";

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

function normalizeCoverPosition(value: string) {
  const allowed = new Set([
    "left top", "center top", "right top",
    "left center", "center center", "right center",
    "left bottom", "center bottom", "right bottom"
  ]);
  return allowed.has(value) ? value : "center center";
}


async function findDuplicateVideoId(column: "video_id" | "clip_video_id", value: string, currentId: string) {
  const { data, error } = await supabaseAdmin
    .from("pdfs")
    .select("id,title")
    .eq(column, value)
    .neq("id", currentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as { id: string; title: string } | null;
}

function parseUrlList(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return null;
  }
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
  const rawWatermarkPolicy = String(formData.get("watermarkPolicy") ?? existing.watermark_policy ?? "after_first");
  const watermarkPolicy = rawWatermarkPolicy === "none" ? "none" : rawWatermarkPolicy === "all" ? "all" : "after_first";
  const youtubeUrl = String(formData.get("youtubeUrl") ?? existing.youtube_url ?? "").trim();
  const clipYoutubeUrl = String(formData.get("clipYoutubeUrl") ?? existing.clip_youtube_url ?? "").trim();
  const videoId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null;
  const clipVideoId = clipYoutubeUrl ? extractYouTubeVideoId(clipYoutubeUrl) : null;
  if (youtubeUrl && !videoId) return NextResponse.json({ error: "Invalid original YouTube URL." }, { status: 400 });
  if (clipYoutubeUrl && !clipVideoId) return NextResponse.json({ error: "Invalid ClipToPDF/short YouTube URL." }, { status: 400 });
  const coverPosition = normalizeCoverPosition(String(formData.get("coverPosition") ?? existing.cover_position ?? "center center"));

  try {
    if (videoId) {
      const duplicateOriginal = await findDuplicateVideoId("video_id", videoId, id);
      if (duplicateOriginal) {
        return NextResponse.json({ error: `This original YouTube link is already used by another post: ${duplicateOriginal.title}.` }, { status: 409 });
      }
    }
    if (clipVideoId) {
      const duplicateClip = await findDuplicateVideoId("clip_video_id", clipVideoId, id);
      if (duplicateClip) {
        return NextResponse.json({ error: `This ClipToPDF/short YouTube link is already used by another post: ${duplicateClip.title}.` }, { status: 409 });
      }
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Duplicate link check failed." }, { status: 500 });
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pdfs";
  const stamp = Date.now();

  const pageImages = formData.getAll("pageImages").filter((item): item is File => item instanceof File && item.size > 0);
  const pdfFile = formData.get("pdfFile");
  const copyrightImage = formData.get("copyrightImage");
  const coverImage = formData.get("coverImage");
  const directPageImageUrls = parseUrlList(formData.get("pageImageUrls"));
  const directPdfUrl = String(formData.get("pdfUrl") ?? "").trim();
  const directCopyrightImageUrl = String(formData.get("copyrightImageUrl") ?? "").trim();
  const directCoverImageUrl = String(formData.get("coverImageUrl") ?? "").trim();

  const updateData: Record<string, unknown> = {
    title: String(formData.get("title") ?? existing.title).trim() || existing.title,
    category: String(formData.get("category") ?? existing.category).trim() || existing.category,
    creator_name: String(formData.get("creatorName") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    required_plan: normalizedPlan,
    watermark_policy: watermarkPolicy,
    is_pro: normalizedPlan !== "free",
    youtube_url: youtubeUrl || existing.youtube_url,
    video_id: videoId || existing.video_id,
    clip_youtube_url: clipYoutubeUrl || null,
    clip_video_id: clipVideoId || null,
    cover_position: coverPosition
  };

  try {
    if (directPageImageUrls && directPageImageUrls.length > 0) {
      updateData.page_image_urls = directPageImageUrls;
      updateData.thumbnail_url = directPageImageUrls[0] ?? youtubeThumbnail(existing.video_id);
    } else if (pageImages.length > 0) {
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

    if (directCoverImageUrl) {
      updateData.cover_image_url = directCoverImageUrl;
    } else if (coverImage instanceof File && coverImage.size > 0) {
      if (coverImage.type && !coverImage.type.startsWith("image/")) return NextResponse.json({ error: "Card cover image must be an image." }, { status: 400 });
      updateData.cover_image_url = await uploadPublicFile(bucket, `${existing.video_id}/admin-cover/${stamp}-${safeFileName(coverImage.name)}`, coverImage);
    }

    if (directPdfUrl) {
      updateData.pdf_url = directPdfUrl;
    } else if (pdfFile instanceof File && pdfFile.size > 0) {
      if (pdfFile.type && pdfFile.type !== "application/pdf") return NextResponse.json({ error: "PDF file must be a PDF." }, { status: 400 });
      updateData.pdf_url = await uploadPublicFile(bucket, `${existing.video_id}/admin-pdf/${stamp}-${safeFileName(pdfFile.name)}`, pdfFile);
    }

    if (directCopyrightImageUrl) {
      updateData.copyright_image_url = directCopyrightImageUrl;
    } else if (copyrightImage instanceof File && copyrightImage.size > 0) {
      if (copyrightImage.type && !copyrightImage.type.startsWith("image/")) return NextResponse.json({ error: "Copyright file must be an image." }, { status: 400 });
      updateData.copyright_image_url = await uploadPublicFile(bucket, `${existing.video_id}/admin-copyright/${stamp}-${safeFileName(copyrightImage.name)}`, copyrightImage);
    }

    const { data, error } = await supabaseAdmin.from("pdfs").update(updateData).eq("id", id).select("*").single();
    if (error) {
      if (error.message.includes("duplicate key") || error.message.includes("violates unique constraint")) {
        return NextResponse.json({ error: "One of these YouTube links is already connected to another post. Use a different link or edit the existing post." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pdf: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed." }, { status: 500 });
  }
}
