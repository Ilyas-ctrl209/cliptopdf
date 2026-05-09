import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureUserProfile, isPaidPlan, requireUser, todayKey } from "@/lib/authHelpers";
import type { PdfItem } from "@/lib/types";

const FREE_DAILY_VISUAL_LIMIT = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";

  if (!id) {
    return NextResponse.json({ error: "PDF id is required." }, { status: 400 });
  }

  const required = await requireUser(request);
  if ("error" in required) return required.error;

  const profile = await ensureUserProfile(required.user);

  const { data: pdfData, error: pdfError } = await supabaseAdmin
    .from("pdfs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (pdfError || !pdfData) {
    return NextResponse.json({ error: "PDF not found." }, { status: 404 });
  }

  const pdf = pdfData as PdfItem;
  const paid = isPaidPlan(profile.plan);

  if (pdf.is_pro && !paid) {
    return NextResponse.json({
      locked: true,
      reason: "This is a Pro visual PDF.",
      profile,
      limits: {
        dailyVisualLimit: FREE_DAILY_VISUAL_LIMIT,
        dailyDownloads: 1
      },
      pdf: {
        id: pdf.id,
        title: pdf.title,
        category: pdf.category,
        creator_name: pdf.creator_name,
        thumbnail_url: pdf.thumbnail_url,
        is_pro: pdf.is_pro,
        youtube_url: pdf.youtube_url,
        video_id: pdf.video_id
      }
    });
  }

  if (!paid) {
    const viewDate = todayKey();

    const { data: alreadyViewed } = await supabaseAdmin
      .from("user_pdf_views")
      .select("id")
      .eq("user_id", required.user.id)
      .eq("pdf_id", id)
      .eq("view_date", viewDate)
      .maybeSingle();

    const { count } = await supabaseAdmin
      .from("user_pdf_views")
      .select("id", { count: "exact", head: true })
      .eq("user_id", required.user.id)
      .eq("view_date", viewDate);

    const usedToday = count ?? 0;

    if (!alreadyViewed && usedToday >= FREE_DAILY_VISUAL_LIMIT) {
      return NextResponse.json({
        locked: true,
        reason: "You reached your free daily reading limit.",
        profile,
        limits: {
          usedVisualReads: usedToday,
          dailyVisualLimit: FREE_DAILY_VISUAL_LIMIT,
          visualReadsLeft: 0,
          dailyDownloads: 1
        },
        pdf: {
          id: pdf.id,
          title: pdf.title,
          category: pdf.category,
          creator_name: pdf.creator_name,
          thumbnail_url: pdf.thumbnail_url,
          is_pro: pdf.is_pro,
          youtube_url: pdf.youtube_url,
          video_id: pdf.video_id
        }
      }, { status: 403 });
    }

    if (!alreadyViewed) {
      await supabaseAdmin.from("user_pdf_views").insert({
        user_id: required.user.id,
        pdf_id: id,
        view_date: viewDate
      });
    }
  }

  const { count: usedViews } = await supabaseAdmin
    .from("user_pdf_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", required.user.id)
    .eq("view_date", todayKey());

  const { count: usedDownloads } = await supabaseAdmin
    .from("user_pdf_downloads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", required.user.id)
    .eq("download_date", todayKey());

  const safePdf = { ...pdf, pdf_url: pdf.pdf_url ? "download-controlled" : null };

  return NextResponse.json({
    ok: true,
    pdf: safePdf,
    profile,
    access: {
      isPaid: paid,
      showFreeWatermark: !paid,
      canDownloadToday: paid || (usedDownloads ?? 0) < 1
    },
    limits: {
      usedVisualReads: usedViews ?? 0,
      dailyVisualLimit: FREE_DAILY_VISUAL_LIMIT,
      visualReadsLeft: paid ? "unlimited" : Math.max(0, FREE_DAILY_VISUAL_LIMIT - (usedViews ?? 0)),
      usedDownloads: usedDownloads ?? 0,
      dailyDownloads: paid ? "unlimited" : 1,
      downloadsLeft: paid ? "unlimited" : Math.max(0, 1 - (usedDownloads ?? 0))
    }
  });
}
