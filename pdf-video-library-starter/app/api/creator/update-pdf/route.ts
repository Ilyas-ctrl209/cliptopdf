import { NextResponse } from "next/server";
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

function normalizePlan(value: string) {
  return value === "premium" ? "premium" : value === "pro" ? "pro" : "free";
}

function normalizeWatermark(value: string) {
  return value === "none" ? "none" : value === "all" ? "all" : "after_first";
}

function normalizeCoverPosition(value: string) {
  const allowed = new Set([
    "left top", "center top", "right top",
    "left center", "center center", "right center",
    "left bottom", "center bottom", "right bottom"
  ]);
  return allowed.has(value) ? value : "center center";
}

async function getUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return { user: null, error: "Login required." };
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return { user: null, error: "Invalid login session." };
  return { user: userData.user, error: null };
}

async function getExisting(id: string, userId: string) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("pdfs")
    .select("*")
    .eq("id", id)
    .eq("creator_user_id", userId)
    .maybeSingle();

  if (existingError || !existing) return null;
  return existing;
}

export async function POST(request: Request) {
  const { user, error: authError } = await getUser(request);
  if (!user) return NextResponse.json({ error: authError }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      const id = String(body.id ?? "");
      if (!id) return NextResponse.json({ error: "Page id is required." }, { status: 400 });

      const existing = await getExisting(id, user.id);
      if (!existing) return NextResponse.json({ error: "This page was not found in your creator account." }, { status: 404 });

      const youtubeUrl = String(body.youtubeUrl ?? existing.youtube_url ?? "").trim();
      const clipYoutubeUrl = String(body.clipYoutubeUrl ?? "").trim();
      const videoId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null;
      const clipVideoId = clipYoutubeUrl ? extractYouTubeVideoId(clipYoutubeUrl) : null;
      if (youtubeUrl && !videoId) return NextResponse.json({ error: "Invalid original YouTube URL." }, { status: 400 });
      if (clipYoutubeUrl && !clipVideoId) return NextResponse.json({ error: "Invalid ClipToPDF/short YouTube URL." }, { status: 400 });

      const pageImageUrls = Array.isArray(body.pageImageUrls) ? body.pageImageUrls.filter((url: unknown): url is string => typeof url === "string" && url.length > 0) : undefined;
      const pdfUrl = typeof body.pdfUrl === "string" && body.pdfUrl.length > 0 ? body.pdfUrl : undefined;
      const copyrightImageUrl = typeof body.copyrightImageUrl === "string" && body.copyrightImageUrl.length > 0 ? body.copyrightImageUrl : undefined;
      const coverImageUrl = typeof body.coverImageUrl === "string" && body.coverImageUrl.length > 0 ? body.coverImageUrl : undefined;
      const coverPosition = normalizeCoverPosition(String(body.coverPosition ?? existing.cover_position ?? "center center"));

      const updateData: Record<string, unknown> = {
        title: String(body.title ?? existing.title).trim() || existing.title,
        category: String(body.category ?? existing.category).trim() || existing.category,
        creator_name: String(body.creatorName ?? existing.creator_name ?? "").trim() || existing.creator_name,
        description: String(body.description ?? existing.description ?? "").trim() || null,
        required_plan: normalizePlan(String(body.requiredPlan ?? existing.required_plan ?? "free")),
        watermark_policy: normalizeWatermark(String(body.watermarkPolicy ?? existing.watermark_policy ?? "after_first")),
        youtube_url: youtubeUrl || existing.youtube_url,
        video_id: videoId || existing.video_id,
        clip_youtube_url: clipYoutubeUrl || null,
        clip_video_id: clipVideoId || null,
        cover_position: coverPosition
      };

      updateData.is_pro = updateData.required_plan !== "free";

      if (pageImageUrls && pageImageUrls.length > 0) {
        updateData.page_image_urls = pageImageUrls;
        updateData.thumbnail_url = pageImageUrls[0] ?? youtubeThumbnail(existing.video_id);
      }
      if (pdfUrl) updateData.pdf_url = pdfUrl;
      if (coverImageUrl) updateData.cover_image_url = coverImageUrl;
      if (copyrightImageUrl) updateData.copyright_image_url = copyrightImageUrl;

      const { data, error } = await supabaseAdmin.from("pdfs").update(updateData).eq("id", id).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, pdf: data });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed." }, { status: 500 });
    }
  }

  // Backward-compatible old form upload route. New creator page uploads files directly to Supabase first.
  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  if (!id) return NextResponse.json({ error: "Page id is required." }, { status: 400 });

  const existing = await getExisting(id, user.id);
  if (!existing) return NextResponse.json({ error: "This page was not found in your creator account." }, { status: 404 });

  const normalizedPlan = normalizePlan(String(formData.get("requiredPlan") ?? existing.required_plan ?? "free"));
  const watermarkPolicy = normalizeWatermark(String(formData.get("watermarkPolicy") ?? existing.watermark_policy ?? "after_first"));
  const youtubeUrl = String(formData.get("youtubeUrl") ?? existing.youtube_url ?? "").trim();
  const clipYoutubeUrl = String(formData.get("clipYoutubeUrl") ?? existing.clip_youtube_url ?? "").trim();
  const videoId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null;
  const clipVideoId = clipYoutubeUrl ? extractYouTubeVideoId(clipYoutubeUrl) : null;
  if (youtubeUrl && !videoId) return NextResponse.json({ error: "Invalid original YouTube URL." }, { status: 400 });
  if (clipYoutubeUrl && !clipVideoId) return NextResponse.json({ error: "Invalid ClipToPDF/short YouTube URL." }, { status: 400 });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pdfs";
  const stamp = Date.now();

  const pageImages = formData.getAll("pageImages").filter((item): item is File => item instanceof File && item.size > 0);
  const pdfFile = formData.get("pdfFile");
  const copyrightImage = formData.get("copyrightImage");
  const coverImage = formData.get("coverImage");
  const coverPosition = normalizeCoverPosition(String(formData.get("coverPosition") ?? existing.cover_position ?? "center center"));

  const updateData: Record<string, unknown> = {
    title: String(formData.get("title") ?? existing.title).trim() || existing.title,
    category: String(formData.get("category") ?? existing.category).trim() || existing.category,
    creator_name: String(formData.get("creatorName") ?? existing.creator_name ?? "").trim() || existing.creator_name,
    description: String(formData.get("description") ?? existing.description ?? "").trim() || null,
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
    if (pageImages.length > 0) {
      const pageImageUrls: string[] = [];
      for (let index = 0; index < pageImages.length; index++) {
        const image = pageImages[index];
        if (image.type && !image.type.startsWith("image/")) return NextResponse.json({ error: "Page images must be images." }, { status: 400 });
        const imagePath = `${existing.video_id}/creator-edit-pages/${stamp}-${String(index + 1).padStart(2, "0")}-${safeFileName(image.name)}`;
        pageImageUrls.push(await uploadPublicFile(bucket, imagePath, image));
      }
      updateData.page_image_urls = pageImageUrls;
      updateData.thumbnail_url = pageImageUrls[0] ?? youtubeThumbnail(existing.video_id);
    }

    if (coverImage instanceof File && coverImage.size > 0) {
      if (coverImage.type && !coverImage.type.startsWith("image/")) return NextResponse.json({ error: "Card cover image must be an image." }, { status: 400 });
      updateData.cover_image_url = await uploadPublicFile(bucket, `${existing.video_id}/creator-edit-cover/${stamp}-${safeFileName(coverImage.name)}`, coverImage);
    }

    if (pdfFile instanceof File && pdfFile.size > 0) {
      if (pdfFile.type && pdfFile.type !== "application/pdf") return NextResponse.json({ error: "PDF file must be a PDF." }, { status: 400 });
      updateData.pdf_url = await uploadPublicFile(bucket, `${existing.video_id}/creator-edit-pdf/${stamp}-${safeFileName(pdfFile.name)}`, pdfFile);
    }

    if (copyrightImage instanceof File && copyrightImage.size > 0) {
      if (copyrightImage.type && !copyrightImage.type.startsWith("image/")) return NextResponse.json({ error: "Copyright file must be an image." }, { status: 400 });
      updateData.copyright_image_url = await uploadPublicFile(bucket, `${existing.video_id}/creator-edit-copyright/${stamp}-${safeFileName(copyrightImage.name)}`, copyrightImage);
    }

    const { data, error } = await supabaseAdmin.from("pdfs").update(updateData).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, pdf: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed." }, { status: 500 });
  }
}
