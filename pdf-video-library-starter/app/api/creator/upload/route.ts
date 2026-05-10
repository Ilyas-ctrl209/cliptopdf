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

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid login session." }, { status: 401 });
  }

  await ensureUserProfile(userData.user);

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
  const category = String(formData.get("category") ?? "recipe").trim() || "recipe";
  const userName = String(userData.user.user_metadata?.full_name ?? userData.user.user_metadata?.name ?? "").trim();
  const creatorName = String(formData.get("creatorName") ?? "").trim() || userName || userData.user.email || "Creator";
  const description = String(formData.get("description") ?? "").trim() || null;
  const rawPlan = String(formData.get("requiredPlan") ?? "").trim();
  const legacyIsPro = String(formData.get("isPro") ?? "false") === "true";
  const requiredPlan = rawPlan === "premium" ? "premium" : rawPlan === "pro" || legacyIsPro ? "pro" : "free";
  const pdfFile = formData.get("pdfFile");
  const copyrightImage = formData.get("copyrightImage");
  const pageImages = formData
    .getAll("pageImages")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!youtubeUrl) return NextResponse.json({ error: "YouTube URL is required." }, { status: 400 });
  if (pageImages.length === 0) return NextResponse.json({ error: "Upload at least one page image." }, { status: 400 });

  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL." }, { status: 400 });

  for (const image of pageImages) {
    if (image.type && !image.type.startsWith("image/")) {
      return NextResponse.json({ error: "Page images must be PNG, JPG, or WebP files." }, { status: 400 });
    }
  }

  if (pdfFile instanceof File && pdfFile.size > 0 && pdfFile.type && pdfFile.type !== "application/pdf") {
    return NextResponse.json({ error: "Optional PDF file must be a PDF." }, { status: 400 });
  }

  if (copyrightImage instanceof File && copyrightImage.size > 0 && copyrightImage.type && !copyrightImage.type.startsWith("image/")) {
    return NextResponse.json({ error: "Copyright/watermark file must be an image." }, { status: 400 });
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pdfs";
  const stamp = Date.now();

  try {
    const pageImageUrls: string[] = [];
    for (let index = 0; index < pageImages.length; index++) {
      const image = pageImages[index];
      const imagePath = `${videoId}/pages/${stamp}-${String(index + 1).padStart(2, "0")}-${safeFileName(image.name)}`;
      pageImageUrls.push(await uploadPublicFile(bucket, imagePath, image));
    }

    let pdfUrl: string | null = null;
    let copyrightImageUrl: string | null = null;

    if (copyrightImage instanceof File && copyrightImage.size > 0) {
      const copyrightPath = `${videoId}/copyright/${stamp}-${safeFileName(copyrightImage.name)}`;
      copyrightImageUrl = await uploadPublicFile(bucket, copyrightPath, copyrightImage);
    }

    if (pdfFile instanceof File && pdfFile.size > 0) {
      const pdfPath = `${videoId}/pdf/${stamp}-${safeFileName(pdfFile.name)}`;
      pdfUrl = await uploadPublicFile(bucket, pdfPath, pdfFile);
    }

    await supabaseAdmin.from("creator_profiles").upsert(
      {
        user_id: userData.user.id,
        display_name: creatorName,
        email: userData.user.email,
        avatar_url: String(userData.user.user_metadata?.avatar_url ?? "") || null
      },
      { onConflict: "user_id" }
    );

    const { data, error: insertError } = await supabaseAdmin
      .from("pdfs")
      .upsert(
        {
          video_id: videoId,
          youtube_url: youtubeUrl,
          title,
          category,
          creator_name: creatorName,
          creator_user_id: userData.user.id,
          description,
          pdf_url: pdfUrl,
          page_image_urls: pageImageUrls,
          thumbnail_url: pageImageUrls[0] ?? youtubeThumbnail(videoId),
          copyright_image_url: copyrightImageUrl,
          is_pro: requiredPlan !== "free",
          required_plan: requiredPlan
        },
        { onConflict: "video_id" }
      )
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, pdf: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}
