"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { PdfItem, SiteSettings } from "@/lib/types";

type Stats = {
  pdfCount: number;
  userCount: number;
  creatorCount: number;
  requestCount: number;
  viewsToday: number;
  downloadsToday: number;
};

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  subscription_status: string | null;
  created_at: string;
};

function accessLabel(pdf: PdfItem) {
  const required = pdf.required_plan ?? (pdf.is_pro ? "pro" : "free");
  return required === "premium" ? "Premium" : required === "pro" ? "Pro" : "Free";
}

function pageCount(pdf: PdfItem) {
  return Array.isArray(pdf.page_image_urls) ? pdf.page_image_urls.length : 0;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [selected, setSelected] = useState<PdfItem | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "homepage" | "pages" | "upload" | "users">("overview");

  async function loadDashboard(pass = password) {
    setLoading(true);
    setMessage("Loading admin editor...");
    const response = await fetch("/api/admin/dashboard", {
      headers: { "x-admin-password": pass },
      cache: "no-store"
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error ?? "Wrong password.");
      setUnlocked(false);
      return;
    }
    setUnlocked(true);
    setStats(data.stats);
    setPdfs(data.pdfs ?? []);
    setUsers(data.users ?? []);
    setSettings(data.settings ?? {});
    setMessage("Admin editor opened.");
  }

  async function unlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    sessionStorage.setItem("cliptopdf_admin_password", password);
    await loadDashboard(password);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("cliptopdf_admin_password");
    if (saved) {
      setPassword(saved);
      loadDashboard(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveHomepage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Saving homepage...");
    const formData = new FormData(e.currentTarget);
    formData.set("password", password);
    const response = await fetch("/api/admin/site-settings", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not save homepage.");
      return;
    }
    setSettings(data.settings ?? {});
    setMessage("Homepage saved. Refresh home page to see the new images.");
  }

  async function uploadNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Uploading new visual page...");
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("password", password);
    formData.set("requiredPlan", String(formData.get("requiredPlan") ?? "free"));
    const response = await fetch("/api/admin/create-pdf", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Upload failed.");
      return;
    }
    setMessage(`Uploaded: ${data.pdf.title}`);
    form.reset();
    await loadDashboard();
  }

  async function updateSelected(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setMessage("Updating page...");
    const formData = new FormData(e.currentTarget);
    formData.set("password", password);
    formData.set("id", selected.id);
    const response = await fetch("/api/admin/update-pdf", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Update failed.");
      return;
    }
    setMessage(`Updated: ${data.pdf.title}`);
    setSelected(data.pdf);
    await loadDashboard();
  }

  async function deleteSelected() {
    if (!selected) return;
    const ok = window.confirm(`Delete ${selected.title}? This removes it from the database.`);
    if (!ok) return;
    setMessage("Deleting page...");
    const response = await fetch("/api/admin/delete-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, id: selected.id })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Delete failed.");
      return;
    }
    setSelected(null);
    setMessage("Page deleted.");
    await loadDashboard();
  }

  if (!unlocked) {
    return (
      <main className="container auth-wrap">
        <form className="auth-card admin-lock-card pop-in" onSubmit={unlock}>
          <span className="badge">Admin lock</span>
          <h1>Enter admin password.</h1>
          <p className="helper big-helper">This opens the private editor where you can edit homepage images, pages, users, pricing setup, and uploads.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ADMIN_PASSWORD" required />
          <button className="btn" type="submit" disabled={loading}>{loading ? "Checking..." : "Open admin editor"}</button>
          {message && <p className="message error">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="container admin-wrap admin-editor">
      <section className="section-title compact-title">
        <div>
          <span className="badge">Admin editor</span>
          <h1>Control the whole site</h1>
        </div>
        <div className="card-actions">
          <button className="btn ghost" onClick={() => loadDashboard()} disabled={loading}>Refresh</button>
          <a className="btn ghost" href="/">View site</a>
        </div>
      </section>

      {message && <p className={message.includes("failed") || message.includes("Wrong") || message.includes("Could") ? "message error" : "message success"}>{message}</p>}

      <div className="admin-tabs">
        {(["overview", "homepage", "pages", "upload", "users"] as const).map((tab) => (
          <button key={tab} className={activeTab === tab ? "tab active" : "tab"} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <section className="stats-grid pop-in">
          <div className="stat-card"><span>Total pages</span><strong>{stats?.pdfCount ?? 0}</strong></div>
          <div className="stat-card"><span>Users</span><strong>{stats?.userCount ?? 0}</strong></div>
          <div className="stat-card"><span>Creators</span><strong>{stats?.creatorCount ?? 0}</strong></div>
          <div className="stat-card"><span>Requests</span><strong>{stats?.requestCount ?? 0}</strong></div>
          <div className="stat-card"><span>Views today</span><strong>{stats?.viewsToday ?? 0}</strong></div>
          <div className="stat-card"><span>Downloads today</span><strong>{stats?.downloadsToday ?? 0}</strong></div>
        </section>
      )}

      {activeTab === "homepage" && (
        <form className="admin-card pop-in" onSubmit={saveHomepage}>
          <span className="badge">Homepage editor</span>
          <h2>Hero text and card images</h2>
          <div className="form-grid">
            <label className="full">Hero title<input name="heroTitle" defaultValue={settings.hero_title ?? "Make scrolling feel like reading again."} /></label>
            <label className="full">Hero subtitle<textarea name="heroSubtitle" defaultValue={settings.hero_subtitle ?? "Paste a YouTube link and open the visual PDF version instantly."} /></label>
            <label>Recipe PDF card image<input type="file" name="recipeHeroImage" accept="image/png,image/jpeg,image/webp" /></label>
            <label>Animal PDF card image<input type="file" name="animalHeroImage" accept="image/png,image/jpeg,image/webp" /></label>
          </div>
          <div className="settings-preview">
            {settings.recipe_hero_image_url && <img src={settings.recipe_hero_image_url} alt="Recipe hero" />}
            {settings.animal_hero_image_url && <img src={settings.animal_hero_image_url} alt="Animal hero" />}
          </div>
          <button className="btn" type="submit">Save homepage</button>
        </form>
      )}

      {activeTab === "pages" && (
        <section className="admin-split pop-in">
          <div className="panel page-list-panel">
            <h2>All visual pages ({pdfs.length})</h2>
            <div className="admin-page-list">
              {pdfs.map((pdf) => (
                <button className={selected?.id === pdf.id ? "admin-page-row selected" : "admin-page-row"} key={pdf.id} onClick={() => setSelected(pdf)}>
                  <img src={pdf.thumbnail_url ?? ""} alt="" />
                  <span><strong>{pdf.title}</strong><small>{accessLabel(pdf)} • {pdf.category} • {pageCount(pdf)} images</small></span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel page-editor-panel">
            {!selected ? <p className="helper">Choose a page from the list to edit it.</p> : (
              <form onSubmit={updateSelected}>
                <span className={accessLabel(selected) === "Premium" ? "tag premium" : accessLabel(selected) === "Pro" ? "tag pro" : "tag"}>{accessLabel(selected)}</span>
                <h2>Edit page</h2>
                <div className="form-grid single-form-grid">
                  <label>Title<input name="title" defaultValue={selected.title} /></label>
                  <label>Category<input name="category" defaultValue={selected.category} /></label>
                  <label>Creator name<input name="creatorName" defaultValue={selected.creator_name ?? ""} /></label>
                  <label>Access level
                    <select name="requiredPlan" defaultValue={selected.required_plan ?? (selected.is_pro ? "pro" : "free") }>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="premium">Premium</option>
                    </select>
                  </label>
                  <label>Description<textarea name="description" defaultValue={selected.description ?? ""} /></label>
                  <label>Replace page images<input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple /></label>
                  <label>Replace optional PDF<input type="file" name="pdfFile" accept="application/pdf" /></label>
                  <label>Replace free-user watermark<input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" /></label>
                </div>
                <div className="card-actions">
                  <button className="btn" type="submit">Save page</button>
                  <button className="btn ghost danger" type="button" onClick={deleteSelected}>Delete page</button>
                  <a className="btn ghost" href={`/pdf/${selected.id}`} target="_blank">Preview</a>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {activeTab === "upload" && (
        <form className="admin-card pop-in" onSubmit={uploadNew}>
          <span className="badge">Admin upload</span>
          <h2>Create a new visual PDF entry</h2>
          <div className="form-grid">
            <label className="full">YouTube link<input name="youtubeUrl" placeholder="https://www.youtube.com/watch?v=..." required /></label>
            <label>Title<input name="title" placeholder="Eggs with Tomato and Cheese" required /></label>
            <label>Category<select name="category" defaultValue="recipe"><option value="recipe">Recipe</option><option value="animal">Endangered animal</option><option value="hadith">Hadith</option><option value="study">Study notes</option></select></label>
            <label>Creator name<input name="creatorName" placeholder="Example: @BayashiTV" /></label>
            <label>Access level<select name="requiredPlan" defaultValue="free"><option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option></select></label>
            <label>Optional PDF file<input type="file" name="pdfFile" accept="application/pdf" /></label>
            <label>Free-user watermark image<input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" /></label>
            <label className="full">Page images<input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple required /><span className="helper">Upload the attractive page images. The first image becomes the card cover.</span></label>
            <label className="full">Description<textarea name="description" placeholder="Short description..." /></label>
          </div>
          <button className="btn" type="submit">Upload visual page</button>
        </form>
      )}

      {activeTab === "users" && (
        <section className="panel pop-in">
          <h2>Latest users</h2>
          <div className="user-table">
            {users.map((user) => (
              <div className="user-row" key={user.id}>
                {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <span className="avatar-fallback small-avatar">U</span>}
                <strong>{user.display_name || user.email || "User"}</strong>
                <span>{user.email}</span>
                <span className={user.plan === "premium" ? "tag premium" : user.plan === "pro" || user.plan === "admin" ? "tag pro" : "tag"}>{user.plan}</span>
                <span>{user.subscription_status || "—"}</span>
              </div>
            ))}
          </div>
          <p className="helper">For now, manual plan changes are still done in Supabase SQL. Stripe will update plans automatically after checkout/webhook is configured.</p>
        </section>
      )}
    </main>
  );
}
