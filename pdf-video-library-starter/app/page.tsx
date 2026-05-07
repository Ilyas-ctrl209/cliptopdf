"use client";

import { useEffect, useState } from "react";
import type { PdfItem } from "@/lib/types";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; pdf: PdfItem }
  | { status: "missing"; videoId: string; youtubeUrl: string }
  | { status: "error"; message: string };

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [featured, setFeatured] = useState<PdfItem[]>([]);
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    fetch("/api/pdfs")
      .then((res) => res.json())
      .then((data) => setFeatured(data.pdfs ?? []))
      .catch(() => setFeatured([]));
  }, []);

  async function handleSearch(e: React.FormEvent) {
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
    setRequestMessage("Request saved. You can create this PDF later from your admin dashboard.");
  }

  return (
    <main>
      <section className="container hero">
        <div>
          <span className="badge">YouTube link in → beautiful PDF out</span>
          <h1>Make scrolling feel like reading again.</h1>
          <p>
            Paste a YouTube recipe link. If you already made the PDF, the site opens it instantly.
            Later you can add animals, hadith notes, study sheets, and premium collections.
          </p>

          <form className="search-card" onSubmit={handleSearch}>
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

            {search.status === "loading" && <div className="message">Searching your PDF library...</div>}
            {search.status === "error" && <div className="message error">{search.message}</div>}

            {search.status === "found" && (
              <div className="result-card">
                <img src={search.pdf.thumbnail_url ?? "/placeholder.svg"} alt="PDF thumbnail" />
                <div>
                  <span className={search.pdf.is_pro ? "tag pro" : "tag"}>
                    {search.pdf.is_pro ? "Pro" : "Free"}
                  </span>
                  <h3>{search.pdf.title}</h3>
                  <p className="meta">{search.pdf.category} {search.pdf.creator_name ? `• ${search.pdf.creator_name}` : ""}</p>
                  <div className="card-actions">
                    <a className="btn" href={`/pdf/${search.pdf.id}`}>Open PDF</a>
                    <a className="btn ghost" href={search.pdf.youtube_url} target="_blank">Open YouTube</a>
                  </div>
                </div>
              </div>
            )}

            {search.status === "missing" && (
              <div className="request-box">
                <h3>No PDF found for this video yet.</h3>
                <p className="helper">Save it as a request, then create the PDF and upload it from /admin.</p>
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
        </div>

        <div className="hero-preview" aria-hidden="true">
          <div className="stack-card">
            <span className="tape">Recipe PDF</span>
            <div className="fake-image">Crispy Chicken Stack</div>
            <div className="mini-grid">
              <div className="mini">Ingredients</div>
              <div className="mini">Steps</div>
              <div className="mini">Tips</div>
            </div>
          </div>
          <div className="stack-card">
            <span className="tape">Animal PDF</span>
            <div className="fake-image animal">Endangered Animal Facts</div>
            <div className="mini-grid">
              <div className="mini">Habitat</div>
              <div className="mini">Diet</div>
              <div className="mini">Traits</div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-title">
          <div>
            <span className="badge">Library</span>
            <h2>Recently added PDFs</h2>
          </div>
          <p>Upload your 12 recipe PDFs in the admin page. They will appear here automatically.</p>
        </div>

        <div className="grid">
          {featured.length === 0 && (
            <div className="panel">
              <h3>No PDFs yet.</h3>
              <p className="helper">Go to /admin and upload your first recipe PDF.</p>
            </div>
          )}

          {featured.map((pdf) => (
            <article className="pdf-card" key={pdf.id}>
              <img src={pdf.thumbnail_url ?? "/placeholder.svg"} alt={pdf.title} />
              <div className="pdf-body">
                <span className={pdf.is_pro ? "tag pro" : "tag"}>{pdf.is_pro ? "Pro" : "Free"}</span>
                <h3>{pdf.title}</h3>
                <p className="meta">{pdf.category} {pdf.creator_name ? `• ${pdf.creator_name}` : ""}</p>
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
