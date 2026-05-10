import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canAccessRequiredPlan, ensureUserProfile, isPaidPlan, requireUser, todayKey } from "@/lib/authHelpers";
import type { PdfItem } from "@/lib/types";

export async function POST(request: Request) {
  const required = await requireUser(request);
  if ("error" in required) return required.error;

  const profile = await ensureUserProfile(required.user);
  const paid = isPaidPlan(profile.plan);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "");

  if (!id) {
    return NextResponse.json({ error: "PDF id is required." }, { status: 400 });
  }

  const { data: pdfData, error: pdfError } = await supabaseAdmin
    .from("pdfs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (pdfError || !pdfData) {
    return NextResponse.json({ error: "PDF not found." }, { status: 404 });
  }

  const pdf = pdfData as PdfItem;

  if (!pdf.pdf_url) {
    return NextResponse.json({ error: "No downloadable PDF file was uploaded for this entry yet." }, { status: 404 });
  }

  const requiredPlan = pdf.required_plan ?? (pdf.is_pro ? "pro" : "free");
  if (!canAccessRequiredPlan(profile.plan, requiredPlan)) {
    return NextResponse.json({ error: requiredPlan === "premium" ? "This PDF download is for Premium users." : "This PDF download is for Pro users." }, { status: 403 });
  }

  if (!paid) {
    const downloadDate = todayKey();
    const { count } = await supabaseAdmin
      .from("user_pdf_downloads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", required.user.id)
      .eq("download_date", downloadDate);

    if ((count ?? 0) >= 1) {
      return NextResponse.json({ error: "Free users can download only 1 PDF per day. Try again tomorrow or upgrade later." }, { status: 403 });
    }

    await supabaseAdmin.from("user_pdf_downloads").insert({
      user_id: required.user.id,
      pdf_id: id,
      download_date: downloadDate
    });
  }

  await supabaseAdmin
    .from("pdfs")
    .update({ download_count: (pdf.download_count ?? 0) + 1 })
    .eq("id", id);

  return NextResponse.json({ ok: true, url: pdf.pdf_url, profile });
}
