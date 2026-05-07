import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractYouTubeVideoId, youtubeThumbnail } from "@/lib/youtube";

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload.pdf";
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const password = String(formData.get("password") ?? "");
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Wrong admin password." }, { status: 401 });
  }

  const title = String(formData.get("title") ?? "").trim();
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
  const category = String(formData.get("category") ?? "recipe").trim() || "recipe";
  const creatorName = String(formData.get("creatorName") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const isPro = String(formData.get("isPro") ?? "false") === "true";
  const file = formData.get("pdfFile");

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!youtubeUrl) return NextResponse.json({ error: "YouTube URL is required." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "PDF file is required." }, { status: 400 });

  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL." }, { status: 400 });

  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Please upload a PDF file only." }, { status: 400 });
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pdfs";
  const path = `${videoId}/${Date.now()}-${safeFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: false,
      cacheControl: "3600"
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  const pdfUrl = publicData.publicUrl;

  const { data, error: insertError } = await supabaseAdmin
    .from("pdfs")
    .upsert(
      {
        video_id: videoId,
        youtube_url: youtubeUrl,
        title,
        category,
        creator_name: creatorName,
        description,
        pdf_url: pdfUrl,
        thumbnail_url: youtubeThumbnail(videoId),
        is_pro: isPro
      },
      { onConflict: "video_id" }
    )
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pdf: data });
}
