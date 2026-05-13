"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { youtubeEmbedUrl } from "@/lib/youtube";
import type { AppUserProfile, PdfItem } from "@/lib/types";

type Limits = {
  usedVisualReads?: number;
  dailyVisualLimit?: number;
  visualReadsLeft?: number | "unlimited";
  usedDownloads?: number;
  dailyDownloads?: number | "unlimited";
  downloadsLeft?: number | "unlimited";
};

type DetailResponse = {
  ok?: boolean;
  locked?: boolean;
  reason?: string;
  pdf?: PdfItem;
  profile?: AppUserProfile;
  access?: {
    isPaid: boolean;
    showFreeWatermark: boolean;
    watermarkPolicy?: "none" | "after_first" | "all";
    defaultWatermarkImageUrl?: string | null;
    canDownloadToday: boolean;
  };
  limits?: Limits;
  error?: string;
};

function normalizeImages(pdf?: Partial<PdfItem>) {
  return Array.isArray(pdf?.page_image_urls) ? pdf.page_image_urls.filter(Boolean) : [];
}

export default function PdfReaderClient({ id }: { id: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadMessage, setDownloadMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? null;
        if (!mounted) return;
        setToken(accessToken);

        if (!accessToken) {
          setData({ locked: true, reason: "Please login to read visual PDFs." });
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/pdf-detail?id=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store"
        });
        const json = await response.json();
        if (!mounted) return;
        setData(json);
      } catch (error) {
        if (!mounted) return;
        setData({ error: error instanceof Error ? error.message : "Could not load this visual PDF." });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [id]);

  async function downloadPdf() {
    if (!token) {
      setDownloadMessage("Login first.");
      return;
    }

    setDownloadMessage("Preparing download...");
    const response = await fetch("/api/pdf-download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ id })
    });
    const json = await response.json();

    if (!response.ok) {
      setDownloadMessage(json.error ?? "Download blocked.");
      return;
    }

    setDownloadMessage("Download allowed. Opening PDF...");
    window.open(json.url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <main className="container pdf-page"><section className="viewer locked"><div><span className="tag">Loading</span><h1>Opening visual PDF...</h1></div></section></main>;
  }

  if (data?.error) {
    return (
      <main className="container auth-wrap">
        <section className="auth-card shake-soft">
          <span className="tag pro">Error</span>
          <h1>Could not open it.</h1>
          <p className="helper big-helper">{data.error}</p>
          <a className="btn" href="/">Go home</a>
        </section>
      </main>
    );
  }

  if (!data?.pdf || data.locked) {
    const preview = data?.pdf;
    return (
      <main className="container auth-wrap">
        <section className="auth-card locked-upgrade-card pop-in">
          <span className="tag pro">Locked</span>
          {preview?.thumbnail_url && <img className="locked-thumb" src={preview.thumbnail_url} alt={preview.title ?? "Locked visual PDF"} />}
          <h1>{preview?.title ?? "Login required"}</h1>
          <p className="helper big-helper">{data?.reason ?? "Please login to continue."}</p>
          <div className="limit-strip">
            <span>Free reads: 10/day</span>
            <span>Free downloads: 1/day</span>
            <span>Pro: unlimited later</span>
          </div>
          <div className="card-actions">
            <a className="btn" href="/login">Login</a>
            <a className="btn ghost" href="/pricing">See pricing</a>
          </div>
        </section>
      </main>
    );
  }

  const pdf = data.pdf;
  const pageImages = normalizeImages(pdf);
  const showWatermark = data.access?.showFreeWatermark ?? true;
  const watermarkPolicy = data.access?.watermarkPolicy ?? pdf.watermark_policy ?? "after_first";
  const watermarkImage = pdf.copyright_image_url || data.access?.defaultWatermarkImageUrl || null;
  function shouldWatermarkPage(index: number) {
    if (!showWatermark) return false;
    if (watermarkPolicy === "none") return false;
    if (watermarkPolicy === "all") return true;
    return index > 0;
  }
  const planLabel = data.profile?.plan === "admin" ? "ADMIN" : data.profile?.plan === "premium" ? "PREMIUM" : data.profile?.plan === "pro" ? "PRO" : "FREE";

  return (
    <main className="container pdf-page image-pdf-page">
      <section className="viewer image-viewer">
        {pageImages.length > 0 ? (
          <div className="page-image-stack">
            {pageImages.map((src, index) => {
              const pageWatermarked = shouldWatermarkPage(index);
              return (
              <figure className={`reader-page animated-page ${pageWatermarked ? "free-watermarked" : ""}`} key={src}>
                <img src={src} alt={`${pdf.title} page ${index + 1}`} draggable={false} />
                {pageWatermarked && (
                  <div className="copyright-layer" aria-hidden="true">
                    {watermarkImage ? <img src={watermarkImage} alt="" /> : <span>© {pdf.creator_name || "ClipToPDF"} • Free preview</span>}
                  </div>
                )}
                <figcaption>{pageWatermarked ? `Page ${index + 1} • free preview watermark` : `Page ${index + 1}`}</figcaption>
              </figure>
              );
            })}
          </div>
        ) : (
          <div className="locked">
            <div>
              <h1>No page images yet.</h1>
              <p className="helper">Ask the creator to upload PNG/JPG page images.</p>
            </div>
          </div>
        )}
      </section>

      <aside className="sidebar sticky-sidebar">
        <div className="panel visual-info-card pop-in">
          <div className="plan-row">
            <span className={pdf.required_plan === "premium" ? "tag premium" : pdf.required_plan === "pro" || pdf.is_pro ? "tag pro" : "tag"}>{pdf.required_plan === "premium" ? "Premium" : pdf.required_plan === "pro" || pdf.is_pro ? "Pro" : "Free"}</span>
            <span className={planLabel === "FREE" ? "tag" : planLabel === "PREMIUM" ? "tag premium glow-badge" : "tag pro glow-badge"}>Your plan: {planLabel}</span>
          </div>
          <h1>{pdf.title}</h1>
          <p className="meta">
            {pdf.category} {pdf.creator_name ? `• ${pdf.creator_name}` : ""} • {pageImages.length || "0"} image pages
          </p>
          {pdf.description && <p className="helper">{pdf.description}</p>}
          <div className="limits-card">
            <strong>Today</strong>
            <span>Reads left: {data.limits?.visualReadsLeft ?? "—"}</span>
            <span>Downloads left: {data.limits?.downloadsLeft ?? "—"}</span>
          </div>
          <div className="card-actions">
            <button className="btn" type="button" onClick={downloadPdf}>{pdf.pdf_url ? "Download PDF version" : "Download clean page"}</button>
            <a className="btn ghost" href={pdf.youtube_url} target="_blank">Watch original</a>
            {pdf.clip_youtube_url && <a className="btn ghost" href={pdf.clip_youtube_url} target="_blank">Watch ClipToPDF video</a>}
          </div>
          {downloadMessage && <p className={downloadMessage.includes("blocked") || downloadMessage.includes("only") ? "message error" : "message success"}>{downloadMessage}</p>}
          {showWatermark && <p className="helper">Free accounts can read 10 visual PDFs per day and download 1 clean file per day. Watermark rules are controlled by the creator/admin.</p>}
        </div>

        <div className="panel pop-in delay-1">
          <h2>Original video</h2>
          <iframe
            className="youtube-frame"
            src={youtubeEmbedUrl(pdf.video_id)}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {pdf.clip_video_id && (
          <div className="panel pop-in delay-2">
            <h2>ClipToPDF video</h2>
            <iframe
              className="youtube-frame"
              src={youtubeEmbedUrl(pdf.clip_video_id)}
              title="ClipToPDF YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        )}
      </aside>
    </main>
  );
}
