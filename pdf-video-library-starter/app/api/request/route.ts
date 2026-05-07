import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractYouTubeVideoId } from "@/lib/youtube";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.youtubeUrl) {
    return NextResponse.json({ error: "YouTube link is required." }, { status: 400 });
  }

  const videoId = body.videoId || extractYouTubeVideoId(body.youtubeUrl);
  if (!videoId) {
    return NextResponse.json({ error: "Invalid YouTube link." }, { status: 400 });
  }

  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;

  const { error } = await supabaseAdmin
    .from("pdf_requests")
    .insert({ youtube_url: body.youtubeUrl, video_id: videoId, email });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
