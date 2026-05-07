"use client";

import { useState, type FormEvent } from "react";

export default function AdminPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("Uploading...");

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("isPro", formData.get("isPro") === "on" ? "true" : "false");

    const response = await fetch("/api/admin/create-pdf", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(data.error ?? "Upload failed.");
      return;
    }

    setMessage(`Uploaded: ${data.pdf.title}`);
    form.reset();
  }

  return (
    <main className="container admin-wrap">
      <div className="section-title">
        <div>
          <span className="badge">Private admin</span>
          <h1>Upload a visual PDF</h1>
        </div>
        <p>This admin page is hidden from the top bar. Public creators should use /creator after Google login.</p>
      </div>

      <form className="admin-card" onSubmit={submit}>
        <div className="form-grid">
          <label className="full">
            Admin password
            <input type="password" name="password" placeholder="Password from ADMIN_PASSWORD" required />
          </label>

          <label className="full">
            YouTube link
            <input name="youtubeUrl" placeholder="https://www.youtube.com/watch?v=..." required />
          </label>

          <label>
            Title
            <input name="title" placeholder="Eggs with Tomato and Cheese" required />
          </label>

          <label>
            Category
            <select name="category" defaultValue="recipe">
              <option value="recipe">Recipe</option>
              <option value="animal">Endangered animal</option>
              <option value="hadith">Hadith</option>
              <option value="study">Study notes</option>
            </select>
          </label>

          <label>
            Creator name
            <input name="creatorName" placeholder="Example: @BayashiTV" />
          </label>

          <label>
            Optional PDF file
            <input type="file" name="pdfFile" accept="application/pdf" />
          </label>

          <label className="full">
            Page images
            <input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple required />
            <span className="helper">Upload the attractive page images. The first image becomes the card cover.</span>
          </label>

          <label className="full">
            Description
            <textarea name="description" placeholder="Short description of this visual PDF..." />
          </label>

          <label className="check-row full">
            <input type="checkbox" name="isPro" />
            Make this PDF Pro-only
          </label>
        </div>

        <div className="card-actions">
          <button className="btn" type="submit" disabled={loading}>{loading ? "Uploading..." : "Upload visual PDF"}</button>
          <a className="btn ghost" href="/">Back home</a>
        </div>

        {message && <p className={message.includes("Uploaded") ? "message success" : "message error"}>{message}</p>}
      </form>
    </main>
  );
}
