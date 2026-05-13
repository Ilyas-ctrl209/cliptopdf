"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { PdfItem } from "@/lib/types";

type UserInfo = {
  email?: string;
  name?: string;
  avatar?: string;
};

function accessLabel(pdf: PdfItem) {
  const required = pdf.required_plan ?? (pdf.is_pro ? "pro" : "free");
  return required === "premium" ? "Premium" : required === "pro" ? "Pro" : "Free";
}

function watermarkLabel(pdf: PdfItem) {
  const policy = pdf.watermark_policy ?? "after_first";
  if (policy === "none") return "No watermark";
  if (policy === "all") return "All pages watermarked";
  return "Page 1 clear, rest watermarked";
}

export default function CreatorPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [myPdfs, setMyPdfs] = useState<PdfItem[]>([]);
  const [selected, setSelected] = useState<PdfItem | null>(null);

  async function loadMyPdfs(token: string) {
    const response = await fetch("/api/creator/my-pdfs", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const data = await response.json();
    if (response.ok) setMyPdfs(data.pdfs ?? []);
  }

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = createSupabaseBrowserClient();

      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        const session = data.session;
        const token = session?.access_token ?? null;
        setAccessToken(token);
        setUser(session?.user ? {
          email: session.user.email ?? "",
          name: String(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "Creator"),
          avatar: String(session.user.user_metadata?.avatar_url ?? "")
        } : null);
        setLoadingUser(false);
        if (token) loadMyPdfs(token);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        const token = session?.access_token ?? null;
        setAccessToken(token);
        setUser(session?.user ? {
          email: session.user.email ?? "",
          name: String(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "Creator"),
          avatar: String(session.user.user_metadata?.avatar_url ?? "")
        } : null);
        setLoadingUser(false);
        if (token) loadMyPdfs(token);
      });

      return () => {
        mounted = false;
        listener.subscription.unsubscribe();
      };
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Auth setup is missing.");
      setLoadingUser(false);
      return;
    }
  }, []);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) {
      setMessage("Please login first.");
      return;
    }

    setUploading(true);
    setMessage("Uploading visual pages...");
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("requiredPlan", String(formData.get("requiredPlan") ?? "free"));
    formData.set("watermarkPolicy", String(formData.get("watermarkPolicy") ?? "after_first"));

    const response = await fetch("/api/creator/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData
    });

    const data = await response.json();
    setUploading(false);

    if (!response.ok) {
      setMessage(data.error ?? "Upload failed.");
      return;
    }

    setMessage(`Uploaded: ${data.pdf.title}`);
    form.reset();
    await loadMyPdfs(accessToken);
  }

  async function updateSelected(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken || !selected) return;
    setMessage("Updating your page...");
    const formData = new FormData(e.currentTarget);
    formData.set("id", selected.id);
    formData.set("watermarkPolicy", String(formData.get("watermarkPolicy") ?? selected.watermark_policy ?? "after_first"));

    const response = await fetch("/api/creator/update-pdf", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Update failed.");
      return;
    }

    setMessage(`Updated: ${data.pdf.title}`);
    setSelected(data.pdf);
    await loadMyPdfs(accessToken);
  }

  if (loadingUser) {
    return <main className="container admin-wrap"><div className="panel">Checking login...</div></main>;
  }

  if (setupError) {
    return (
      <main className="container admin-wrap">
        <div className="panel">
          <span className="tag pro">Setup needed</span>
          <h1>Google login is not connected yet.</h1>
          <p className="helper">{setupError}</p>
          <p className="helper">Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container auth-wrap">
        <section className="auth-card">
          <span className="badge">Creator Studio</span>
          <h1>Login required</h1>
          <p className="helper big-helper">Login with Google first, then you can upload and edit your visual PDF pages.</p>
          <a className="btn" href="/login">Login with Google</a>
        </section>
      </main>
    );
  }

  return (
    <main className="container admin-wrap creator-layout">
      <section className="creator-panel panel">
        <div className="creator-mini">
          {user.avatar ? <img src={user.avatar} alt="Creator avatar" /> : <span className="avatar-fallback">C</span>}
          <div>
            <span className="badge">Creator account</span>
            <h1>{user.name}</h1>
            <p className="helper">{user.email}</p>
          </div>
        </div>
        <p className="helper big-helper">
          Upload page images first. The first image becomes the attractive cover. You can edit previous uploads below.
        </p>
        <button className="btn ghost" onClick={logout} type="button">Logout</button>
      </section>

      <section className="creator-main-stack">
        <form className="admin-card creator-form" onSubmit={submit}>
          <div className="section-title compact-title">
            <div>
              <span className="badge">Upload</span>
              <h2>Create visual PDF entry</h2>
            </div>
          </div>

          <div className="form-grid">
            <label className="full">Original creator YouTube link<input name="youtubeUrl" placeholder="Original video link from the creator" required /></label>
            <label className="full">Your ClipToPDF/short YouTube link<input name="clipYoutubeUrl" placeholder="Your video link that promotes this PDF" required /></label>
            <label>Title<input name="title" placeholder="Eggs with Tomato and Cheese" required /></label>
            <label>Category<select name="category" defaultValue="recipe"><option value="recipe">Recipe</option><option value="animal">Endangered animal</option><option value="hadith">Hadith</option><option value="study">Study notes</option></select></label>
            <label>Creator name / handle<input name="creatorName" placeholder="Example: @simpledeliciousrecipes" defaultValue={user.name ?? ""} /></label>
            <label>Optional PDF file for download<input type="file" name="pdfFile" accept="application/pdf" /><span className="helper">Images are the main attraction. PDF is only for the download button.</span></label>
            <label>Custom free-user watermark image<input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" /><span className="helper">Optional. If empty, the admin default watermark is used.</span></label>
            <label className="full">Page images — upload page 1, page 2, page 3...<input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple required /><span className="helper">Use PNG/JPG page images. This is what visitors will read.</span></label>
            <label className="full">Description<textarea name="description" placeholder="Short description of this visual PDF..." /></label>
            <label>Access level<select name="requiredPlan" defaultValue="free"><option value="free">Free</option><option value="pro">Pro locked</option><option value="premium">Premium locked</option></select></label>
            <label>Free-user watermark rule<select name="watermarkPolicy" defaultValue="after_first"><option value="after_first">Page 1 clear, rest watermarked</option><option value="all">Watermark all pages</option><option value="none">No watermark on this page set</option></select></label>
          </div>

          <div className="card-actions">
            <button className="btn" type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload visual pages"}</button>
            <a className="btn ghost" href="/">Back home</a>
          </div>
          {message && <p className={message.includes("Uploaded") || message.includes("Updated") ? "message success" : "message error"}>{message}</p>}
        </form>

        <div className="admin-card creator-form creator-edit-box">
          <div className="section-title compact-title">
            <div>
              <span className="badge">My uploads</span>
              <h2>Edit previous work</h2>
            </div>
          </div>
          <div className="creator-upload-list">
            {myPdfs.length === 0 ? <p className="helper">No uploads yet.</p> : myPdfs.map((pdf) => (
              <button key={pdf.id} type="button" className={selected?.id === pdf.id ? "admin-page-row selected" : "admin-page-row"} onClick={() => setSelected(pdf)}>
                <img src={pdf.thumbnail_url ?? ""} alt="" />
                <span><strong>{pdf.title}</strong><small>{accessLabel(pdf)} • {watermarkLabel(pdf)}</small></span>
              </button>
            ))}
          </div>

          {selected && (
            <form onSubmit={updateSelected} className="creator-edit-form">
              <h3>Edit: {selected.title}</h3>
              <div className="form-grid">
                <label>Title<input name="title" defaultValue={selected.title} /></label>
                <label>Category<input name="category" defaultValue={selected.category} /></label>
                <label>Creator name<input name="creatorName" defaultValue={selected.creator_name ?? ""} /></label>
                <label className="full">Original creator YouTube link<input name="youtubeUrl" defaultValue={selected.youtube_url ?? ""} /></label>
                <label className="full">Your ClipToPDF/short YouTube link<input name="clipYoutubeUrl" defaultValue={selected.clip_youtube_url ?? ""} /></label>
                <label>Access level<select name="requiredPlan" defaultValue={selected.required_plan ?? (selected.is_pro ? "pro" : "free")}><option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option></select></label>
                <label>Free-user watermark rule<select name="watermarkPolicy" defaultValue={selected.watermark_policy ?? "after_first"}><option value="after_first">Page 1 clear, rest watermarked</option><option value="all">Watermark all pages</option><option value="none">No watermark on this page set</option></select></label>
                <label>Replace optional PDF<input type="file" name="pdfFile" accept="application/pdf" /></label>
                <label>Replace custom watermark<input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" /></label>
                <label className="full">Replace page images<input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple /></label>
                <label className="full">Description<textarea name="description" defaultValue={selected.description ?? ""} /></label>
              </div>
              <div className="card-actions">
                <button className="btn" type="submit">Save changes</button>
                <a className="btn ghost" href={`/pdf/${selected.id}`} target="_blank">Preview</a>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
