import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { youtubeEmbedUrl } from "@/lib/youtube";
import type { PdfItem } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

function getPageImages(pdf: PdfItem) {
  return Array.isArray(pdf.page_image_urls) ? pdf.page_image_urls.filter(Boolean) : [];
}

export default async function PdfPage({ params }: PageProps) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("pdfs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const pdf = data as PdfItem;
  const pageImages = getPageImages(pdf);

  return (
    <main className="container pdf-page image-pdf-page">
      <section className="viewer image-viewer">
        {pdf.is_pro ? (
          <div className="locked">
            <div>
              <span className="tag pro">Pro PDF</span>
              <h1>This visual PDF is locked for Pro users.</h1>
              <p className="helper">
                Payment is not connected yet. Keep testing with free pages first, then add Stripe later.
              </p>
            </div>
          </div>
        ) : pageImages.length > 0 ? (
          <div className="page-image-stack">
            {pageImages.map((src, index) => (
              <figure className="reader-page" key={src}>
                <img src={src} alt={`${pdf.title} page ${index + 1}`} />
                <figcaption>Page {index + 1}</figcaption>
              </figure>
            ))}
          </div>
        ) : pdf.pdf_url ? (
          <iframe src={pdf.pdf_url} title={pdf.title} />
        ) : (
          <div className="locked">
            <div>
              <h1>No page images yet.</h1>
              <p className="helper">Re-upload this entry with PNG/JPG page images from the creator page.</p>
            </div>
          </div>
        )}
      </section>

      <aside className="sidebar sticky-sidebar">
        <div className="panel visual-info-card">
          <span className={pdf.is_pro ? "tag pro" : "tag"}>{pdf.is_pro ? "Pro" : "Free"}</span>
          <h1>{pdf.title}</h1>
          <p className="meta">
            {pdf.category} {pdf.creator_name ? `• ${pdf.creator_name}` : ""} • {pageImages.length || "PDF"} pages
          </p>
          {pdf.description && <p className="helper">{pdf.description}</p>}
          <div className="card-actions">
            {pdf.pdf_url && !pdf.is_pro && <a className="btn" href={pdf.pdf_url} target="_blank">Open PDF file</a>}
            <a className="btn ghost" href={pdf.youtube_url} target="_blank">Watch source</a>
          </div>
        </div>

        <div className="panel">
          <h2>Source video</h2>
          <iframe
            className="youtube-frame"
            src={youtubeEmbedUrl(pdf.video_id)}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </aside>
    </main>
  );
}
