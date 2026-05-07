import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractYouTubeVideoId } from "@/lib/youtube";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const youtubeUrl = searchParams.get("url") ?? "";
  const videoId = extractYouTubeVideoId(youtubeUrl);

  if (!videoId) {
    return NextResponse.json({ error: "This does not look like a valid YouTube link." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("pdfs")
    .select("*")
    .eq("video_id", videoId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ found: false, videoId });
  }

  return NextResponse.json({ found: true, pdf: data });
}
