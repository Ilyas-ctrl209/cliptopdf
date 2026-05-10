"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { PdfItem, SiteSettings } from "@/lib/types";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; pdf: PdfItem }
  | { status: "missing"; videoId: string; youtubeUrl: string }
  | { status: "error"; message: string };

function pageCount(pdf: PdfItem) {
  return Array.isArray(pdf.page_image_urls) ? pdf.page_image_urls.length : 0;
}

function pdfPlan(pdf: PdfItem) {
  return pdf.required_plan ?? (pdf.is_pro ? "pro" : "free");
}

function planLabel(pdf: PdfItem) {
  const plan = pdfPlan(pdf);
  return plan === "premium" ? "Premium" : plan === "pro" ? "Pro" : "Free";
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [featured, setFeatured] = useState<PdfItem[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    fetch("/api/pdfs")
      .then((res) => res.json())
      .then((data) => setFeatured(data.pdfs ?? []))
      .catch(() => setFeatured([]));
    fetch("/api/site-settings")
      .then((res) => res.json())
      .then((data) => setSettings(data.settings ?? {}))
      .catch(() => setSettings({}));
  }, []);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setRequestMessage("");
    if (!url.trim()) {
      setSearch({ status: "error", message: "Paste a YouTube link first." });
      return;
    }

    setSearch({ status: "loading" });
    const response = await fetch(`/api/search?url=${encodeURIComponent(url.trim())}`);
    const data = await response.json();

    if (!response.ok) {
      setSearch({ status: "error", message: data.error ?? "Something went wrong." });
      return;
    }

    if (data.found) {
      setSearch({ status: "found", pdf: data.pdf });
    } else {
      setSearch({ status: "missing", videoId: data.videoId, youtubeUrl: url.trim() });
    }
  }

  async function requestPdf() {
    if (search.status !== "missing") return;
    setRequestMessage("Sending request...");
    const response = await fetch("/api/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: search.youtubeUrl, videoId: search.videoId, email })
    });
    const data = await response.json();
    if (!response.ok) {
      setRequestMessage(data.error ?? "Could not send request.");
      return;
    }
    setRequestMessage("Request saved. A creator can make this visual PDF later.");
  }

  return (
    <main>
      <section className="container hero upgraded-hero">
        <div className="hero-copy float-in">
          <span className="badge">YouTube link in → visual recipe pages out</span>
          <h1>{settings.hero_title || "Make scrolling feel like reading again."}</h1>
          <p>
            {settings.hero_subtitle || "Paste a YouTube recipe link and open the visual PDF version instantly. Built for attractive recipe pages, animal facts, hadith notes, study sheets, and creator-made collections."}
          </p>

          <form className="search-card glow-card" onSubmit={handleSearch}>
            <div className="search-row">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube link here..."
                aria-label="YouTube URL"
              />
              <button className="btn" type="submit">Find PDF</button>
            </div>
            <div className="helper">Example: https://www.youtube.com/watch?v=VIDEO_ID</div>

            {search.status === "loading" && <div className="message pulse-text">Searching your visual library...</div>}
            {search.status === "error" && <div className="message error">{search.message}</div>}

            {search.status === "found" && (
              <div className="result-card float-in">
                <img src={search.pdf.thumbnail_url ?? "/placeholder.svg"} alt="PDF thumbnail" />
                <div>
                  <span className={pdfPlan(search.pdf) === "premium" ? "tag premium" : pdfPlan(search.pdf) === "pro" ? "tag pro" : "tag"}>
                    {planLabel(search.pdf)}
                  </span>
                  <h3>{search.pdf.title}</h3>
                  <p className="meta">
                    {search.pdf.category} {search.pdf.creator_name ? `• ${search.pdf.creator_name}` : ""} • {pageCount(search.pdf) || "visual"} pages
                  </p>
                  <div className="card-actions">
                    <a className="btn" href={`/pdf/${search.pdf.id}`}>Open visual pages</a>
                    <a className="btn ghost" href={search.pdf.youtube_url} target="_blank">Watch source</a>
                  </div>
                </div>
              </div>
            )}

            {search.status === "missing" && (
              <div className="request-box float-in">
                <h3>No visual PDF found for this video yet.</h3>
                <p className="helper">Save it as a request, then a creator can turn it into a visual page set.</p>
                <div className="search-row">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Optional email for request"
                  />
                  <button className="btn secondary" type="button" onClick={requestPdf}>Request PDF</button>
                </div>
                {requestMessage && <div className="message">{requestMessage}</div>}
              </div>
            )}
          </form>

          <div className="hero-actions">
            <a className="btn ghost" href="/signup">Become a creator</a>
            <a className="plain-link" href="#library">Browse latest pages ↓</a>
          </div>
        </div>

        <div className="hero-preview animated-preview" aria-hidden="true">
          <div className="stack-card card-one">
            <span className="tape">Recipe PDF</span>
            {settings.recipe_hero_image_url ? <img className="hero-card-image" src={settings.recipe_hero_image_url} alt="Recipe PDF preview" /> : <div className="fake-image">Crispy Chicken Stack</div>}
            <div className="mini-grid">
              <div className="mini">Ingredients</div>
              <div className="mini">Steps</div>
              <div className="mini">Texture</div>
            </div>
          </div>
          <div className="stack-card card-two">
            <span className="tape">Animal PDF</span>
            {settings.animal_hero_image_url ? <img className="hero-card-image" src={settings.animal_hero_image_url} alt="Animal PDF preview" /> : <div className="fake-image animal">Endangered Animal Facts</div>}
            <div className="mini-grid">
              <div className="mini">Habitat</div>
              <div className="mini">Diet</div>
              <div className="mini">Traits</div>
            </div>
          </div>
        </div>
      </section>

      <section id="library" className="container section">
        <div className="section-title">
          <div>
            <span className="badge">Library</span>
            <h2>Recently added visual PDFs</h2>
          </div>
          <p>Visual recipe pages appear here as soon as creators upload them. The first image becomes the cover.</p>
        </div>

        <div className="grid">
          {featured.length === 0 && (
            <div className="panel">
              <h3>No visual PDFs yet.</h3>
              <p className="helper">Login as a creator and upload your first recipe with page images.</p>
            </div>
          )}

          {featured.map((pdf, index) => (
            <article className="pdf-card float-in" style={{ animationDelay: `${index * 70}ms` }} key={pdf.id}>
              <a href={`/pdf/${pdf.id}`} className="cover-link">
                <img src={pdf.thumbnail_url ?? "/placeholder.svg"} alt={pdf.title} />
                <span className="cover-hover">Open pages</span>
              </a>
              <div className="pdf-body">
                <span className={pdfPlan(pdf) === "premium" ? "tag premium" : pdfPlan(pdf) === "pro" ? "tag pro" : "tag"}>{planLabel(pdf)}</span>
                <h3>{pdf.title}</h3>
                <p className="meta">
                  {pdf.category} {pdf.creator_name ? `• ${pdf.creator_name}` : ""} • {pageCount(pdf) || "visual"} pages
                </p>
                <div className="card-actions">
                  <a className="btn" href={`/pdf/${pdf.id}`}>Open</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
