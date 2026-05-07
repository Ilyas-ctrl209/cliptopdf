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
          <h1>Upload a new PDF</h1>
        </div>
        <p>Use this page to add your 12 recipe PDFs and connect each PDF to its YouTube video link.</p>
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
            PDF title
            <input name="title" placeholder="Crispy Chicken + Cheese-Stuffed Meatball Stack" required />
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
            PDF file
            <input type="file" name="pdfFile" accept="application/pdf" required />
          </label>

          <label className="full">
            Description
            <textarea name="description" placeholder="Short description of this PDF..." />
          </label>

          <label className="check-row full">
            <input type="checkbox" name="isPro" />
            Make this PDF Pro-only
          </label>
        </div>

        <div className="card-actions">
          <button className="btn" type="submit" disabled={loading}>{loading ? "Uploading..." : "Upload PDF"}</button>
          <a className="btn ghost" href="/">Back home</a>
        </div>

        {message && <p className={message.includes("Uploaded") ? "message success" : "message error"}>{message}</p>}
      </form>
    </main>
  );
}
