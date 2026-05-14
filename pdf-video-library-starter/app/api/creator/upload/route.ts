import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractYouTubeVideoId, youtubeThumbnail } from "@/lib/youtube";
import { ensureUserProfile } from "@/lib/authHelpers";

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
}

async function uploadPublicFile(bucket: string, path: string, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
    cacheControl: "3600"
  });

  if (error) throw new Error(error.message);
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function normalizePlan(rawPlan: string, legacyIsPro = false) {
  return rawPlan === "premium" ? "premium" : rawPlan === "pro" || legacyIsPro ? "pro" : "free";
}

function normalizeWatermark(rawWatermarkPolicy: string) {
  return rawWatermarkPolicy === "none" ? "none" : rawWatermarkPolicy === "all" ? "all" : "after_first";
}

function normalizeCoverPosition(value: string) {
  const allowed = new Set([
    "left top", "center top", "right top",
    "left center", "center center", "right center",
    "left bottom", "center bottom", "right bottom"
  ]);
  return allowed.has(value) ? value : "center center";
}

async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return { user: null, error: "Login required." };
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return { user: null, error: "Invalid login session." };
  await ensureUserProfile(userData.user);
  return { user: userData.user, error: null };
}

export async function POST(request: Request) {
  const { user, error: authError } = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: authError }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      const title = String(body.title ?? "").trim();
      const youtubeUrl = String(body.youtubeUrl ?? "").trim();
      const clipYoutubeUrl = String(body.clipYoutubeUrl ?? "").trim();
      const category = String(body.category ?? "recipe").trim() || "recipe";
      const userName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim();
      const creatorName = String(body.creatorName ?? "").trim() || userName || user.email || "Creator";
      const description = String(body.description ?? "").trim() || null;
      const requiredPlan = normalizePlan(String(body.requiredPlan ?? "free").trim());
      const watermarkPolicy = normalizeWatermark(String(body.watermarkPolicy ?? "after_first").trim());
      const pageImageUrls = Array.isArray(body.pageImageUrls) ? body.pageImageUrls.filter((url: unknown): url is string => typeof url === "string" && url.length > 0) : [];
      const pdfUrl = typeof body.pdfUrl === "string" && body.pdfUrl.length > 0 ? body.pdfUrl : null;
      const copyrightImageUrl = typeof body.copyrightImageUrl === "string" && body.copyrightImageUrl.length > 0 ? body.copyrightImageUrl : null;
      const coverImageUrl = typeof body.coverImageUrl === "string" && body.coverImageUrl.length > 0 ? body.coverImageUrl : null;
      const coverPosition = normalizeCoverPosition(String(body.coverPosition ?? "center center"));

      if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
      if (!youtubeUrl) return NextResponse.json({ error: "Original YouTube URL is required." }, { status: 400 });
      if (pageImageUrls.length === 0) return NextResponse.json({ error: "Upload at least one page image." }, { status: 400 });

      const videoId = extractYouTubeVideoId(youtubeUrl);
      const clipVideoId = clipYoutubeUrl ? extractYouTubeVideoId(clipYoutubeUrl) : null;
      if (!videoId) return NextResponse.json({ error: "Invalid original YouTube URL." }, { status: 400 });
      if (clipYoutubeUrl && !clipVideoId) return NextResponse.json({ error: "Invalid ClipToPDF/short YouTube URL." }, { status: 400 });

      await supabaseAdmin.from("creator_profiles").upsert(
        {
          user_id: user.id,
          display_name: creatorName,
          email: user.email,
          avatar_url: String(user.user_metadata?.avatar_url ?? "") || null
        },
        { onConflict: "user_id" }
      );

      const { data, error: insertError } = await supabaseAdmin
        .from("pdfs")
        .upsert(
          {
            video_id: videoId,
            youtube_url: youtubeUrl,
            clip_video_id: clipVideoId,
            clip_youtube_url: clipYoutubeUrl || null,
            title,
            category,
            creator_name: creatorName,
            creator_user_id: user.id,
            description,
            pdf_url: pdfUrl,
            page_image_urls: pageImageUrls,
            thumbnail_url: pageImageUrls[0] ?? youtubeThumbnail(videoId),
            copyright_image_url: copyrightImageUrl,
            watermark_policy: watermarkPolicy,
            is_pro: requiredPlan !== "free",
            required_plan: requiredPlan
          },
          { onConflict: "video_id" }
        )
        .select("*")
        .single();

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      return NextResponse.json({ ok: true, pdf: data });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
    }
  }

  // Backward-compatible old form upload route. New creator page uses direct browser-to-Supabase uploads.
  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
  const clipYoutubeUrl = String(formData.get("clipYoutubeUrl") ?? "").trim();
  const category = String(formData.get("category") ?? "recipe").trim() || "recipe";
  const userName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim();
  const creatorName = String(formData.get("creatorName") ?? "").trim() || userName || user.email || "Creator";
  const description = String(formData.get("description") ?? "").trim() || null;
  const requiredPlan = normalizePlan(String(formData.get("requiredPlan") ?? "").trim(), String(formData.get("isPro") ?? "false") === "true");
  const watermarkPolicy = normalizeWatermark(String(formData.get("watermarkPolicy") ?? "after_first").trim());
  const pdfFile = formData.get("pdfFile");
  const copyrightImage = formData.get("copyrightImage");
  const coverImage = formData.get("coverImage");
  const coverPosition = normalizeCoverPosition(String(formData.get("coverPosition") ?? "center center"));
  const pageImages = formData
    .getAll("pageImages")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!youtubeUrl) return NextResponse.json({ error: "Original YouTube URL is required." }, { status: 400 });
  if (pageImages.length === 0) return NextResponse.json({ error: "Upload at least one page image." }, { status: 400 });

  const videoId = extractYouTubeVideoId(youtubeUrl);
  const clipVideoId = clipYoutubeUrl ? extractYouTubeVideoId(clipYoutubeUrl) : null;
  if (!videoId) return NextResponse.json({ error: "Invalid original YouTube URL." }, { status: 400 });
  if (clipYoutubeUrl && !clipVideoId) return NextResponse.json({ error: "Invalid ClipToPDF/short YouTube URL." }, { status: 400 });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pdfs";
  const stamp = Date.now();

  try {
    const pageImageUrls: string[] = [];
    for (let index = 0; index < pageImages.length; index++) {
      const image = pageImages[index];
      if (image.type && !image.type.startsWith("image/")) return NextResponse.json({ error: "Page images must be PNG, JPG, or WebP files." }, { status: 400 });
      const imagePath = `${videoId}/pages/${stamp}-${String(index + 1).padStart(2, "0")}-${safeFileName(image.name)}`;
      pageImageUrls.push(await uploadPublicFile(bucket, imagePath, image));
    }

    let pdfUrl: string | null = null;
    let copyrightImageUrl: string | null = null;
    let coverImageUrl: string | null = null;

    if (coverImage instanceof File && coverImage.size > 0) {
      if (coverImage.type && !coverImage.type.startsWith("image/")) return NextResponse.json({ error: "Card cover image must be an image." }, { status: 400 });
      coverImageUrl = await uploadPublicFile(bucket, `${videoId}/cover/${stamp}-${safeFileName(coverImage.name)}`, coverImage);
    }

    if (copyrightImage instanceof File && copyrightImage.size > 0) {
      if (copyrightImage.type && !copyrightImage.type.startsWith("image/")) return NextResponse.json({ error: "Copyright/watermark file must be an image." }, { status: 400 });
      copyrightImageUrl = await uploadPublicFile(bucket, `${videoId}/copyright/${stamp}-${safeFileName(copyrightImage.name)}`, copyrightImage);
    }

    if (pdfFile instanceof File && pdfFile.size > 0) {
      if (pdfFile.type && pdfFile.type !== "application/pdf") return NextResponse.json({ error: "Optional PDF file must be a PDF." }, { status: 400 });
      pdfUrl = await uploadPublicFile(bucket, `${videoId}/pdf/${stamp}-${safeFileName(pdfFile.name)}`, pdfFile);
    }

    await supabaseAdmin.from("creator_profiles").upsert(
      {
        user_id: user.id,
        display_name: creatorName,
        email: user.email,
        avatar_url: String(user.user_metadata?.avatar_url ?? "") || null
      },
      { onConflict: "user_id" }
    );

    const { data, error: insertError } = await supabaseAdmin
      .from("pdfs")
      .upsert(
        {
          video_id: videoId,
          youtube_url: youtubeUrl,
          clip_video_id: clipVideoId,
          clip_youtube_url: clipYoutubeUrl || null,
          title,
          category,
          creator_name: creatorName,
          creator_user_id: user.id,
          description,
          pdf_url: pdfUrl,
          page_image_urls: pageImageUrls,
          thumbnail_url: pageImageUrls[0] ?? youtubeThumbnail(videoId),
          cover_image_url: coverImageUrl,
          cover_position: coverPosition,
          copyright_image_url: copyrightImageUrl,
          watermark_policy: watermarkPolicy,
          is_pro: requiredPlan !== "free",
          required_plan: requiredPlan
        },
        { onConflict: "video_id" }
      )
      .select("*")
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ ok: true, pdf: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}
