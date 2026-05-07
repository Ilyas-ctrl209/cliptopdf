import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { youtubeEmbedUrl } from "@/lib/youtube";
import type { PdfItem } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PdfPage({ params }: PageProps) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("pdfs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const pdf = data as PdfItem;

  return (
    <main className="container pdf-page">
      <section className="viewer">
        {pdf.is_pro ? (
          <div className="locked">
            <div>
              <span className="tag pro">Pro PDF</span>
              <h1>This PDF is locked for Pro users.</h1>
              <p className="helper">
                Payment is not connected yet. For now, keep important PDFs free while you test the website,
                then add Stripe later.
              </p>
            </div>
          </div>
        ) : (
          <iframe src={pdf.pdf_url} title={pdf.title} />
        )}
      </section>

      <aside className="sidebar">
        <div className="panel">
          <span className={pdf.is_pro ? "tag pro" : "tag"}>{pdf.is_pro ? "Pro" : "Free"}</span>
          <h1>{pdf.title}</h1>
          <p className="meta">{pdf.category} {pdf.creator_name ? `• ${pdf.creator_name}` : ""}</p>
          {pdf.description && <p className="helper">{pdf.description}</p>}
          <div className="card-actions">
            {!pdf.is_pro && <a className="btn" href={pdf.pdf_url} target="_blank">Open PDF file</a>}
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
