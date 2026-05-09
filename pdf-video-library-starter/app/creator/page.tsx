"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type UserInfo = {
  email?: string;
  name?: string;
  avatar?: string;
};

export default function CreatorPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = createSupabaseBrowserClient();

      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        const session = data.session;
        setAccessToken(session?.access_token ?? null);
        setUser(session?.user ? {
          email: session.user.email ?? "",
          name: String(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "Creator"),
          avatar: String(session.user.user_metadata?.avatar_url ?? "")
        } : null);
        setLoadingUser(false);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setAccessToken(session?.access_token ?? null);
        setUser(session?.user ? {
          email: session.user.email ?? "",
          name: String(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "Creator"),
          avatar: String(session.user.user_metadata?.avatar_url ?? "")
        } : null);
        setLoadingUser(false);
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
    formData.set("isPro", formData.get("isPro") === "on" ? "true" : "false");

    const response = await fetch("/api/creator/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
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
          <p className="helper big-helper">Login with Google first, then you can upload recipe page images.</p>
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
          Upload page images first. The first image becomes the attractive cover, and visitors read image pages first. The optional PDF file stays for download, but free users only get 1 download per day.
        </p>
        <button className="btn ghost" onClick={logout} type="button">Logout</button>
      </section>

      <form className="admin-card creator-form" onSubmit={submit}>
        <div className="section-title compact-title">
          <div>
            <span className="badge">Upload</span>
            <h2>Create visual PDF entry</h2>
          </div>
        </div>

        <div className="form-grid">
          <label className="full">
            YouTube source link
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
            Creator name / handle
            <input name="creatorName" placeholder="Example: @simpledeliciousrecipes" defaultValue={user.name ?? ""} />
          </label>

          <label>
            Optional PDF file for download
            <input type="file" name="pdfFile" accept="application/pdf" />
            <span className="helper">Images are the main attraction. PDF is only for the download button.</span>
          </label>

          <label>
            Free-user copyright / watermark image
            <input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" />
            <span className="helper">Optional. This appears over page images for free users only.</span>
          </label>

          <label className="full">
            Page images — upload page 1, page 2, page 3...
            <input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple required />
            <span className="helper">Use the PNG/JPG page images you showed me. This is what visitors will read.</span>
          </label>

          <label className="full">
            Description
            <textarea name="description" placeholder="Short description of this visual PDF..." />
          </label>

          <label className="check-row full">
            <input type="checkbox" name="isPro" />
            Make this Pro-only / premium locked
          </label>
        </div>

        <div className="card-actions">
          <button className="btn" type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload visual pages"}</button>
          <a className="btn ghost" href="/">Back home</a>
        </div>

        {message && <p className={message.includes("Uploaded") ? "message success" : "message error"}>{message}</p>}
      </form>
    </main>
  );
}
