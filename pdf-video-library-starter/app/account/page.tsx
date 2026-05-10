"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { AppUserProfile } from "@/lib/types";

export default function AccountPage() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token ?? null;
        if (!mounted) return;
        setToken(accessToken);
        if (!accessToken) {
          setLoading(false);
          return;
        }
        const response = await fetch("/api/account/profile", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store"
        });
        const json = await response.json();
        if (mounted) setProfile(json.profile ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setMessage("Saving...");
    const form = new FormData(e.currentTarget);
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        display_name: form.get("display_name"),
        bio: form.get("bio"),
        avatar_url: form.get("avatar_url")
      })
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error ?? "Could not save.");
      return;
    }
    setProfile(json.profile);
    setMessage("Profile saved.");
  }

  async function manageBilling() {
    if (!token) return;
    setMessage("Opening Stripe billing portal...");
    const response = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error ?? "Billing portal is not ready.");
      return;
    }
    window.location.href = json.url;
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return <main className="container admin-wrap"><div className="panel">Loading account...</div></main>;

  if (!token || !profile) {
    return (
      <main className="container auth-wrap">
        <section className="auth-card pop-in">
          <span className="badge">Account</span>
          <h1>Login first.</h1>
          <p className="helper big-helper">You need a normal free account before upgrading to Pro or Premium.</p>
          <a className="btn" href="/login">Login with Google</a>
        </section>
      </main>
    );
  }

  return (
    <main className="container admin-wrap account-grid">
      <section className="panel account-card pop-in">
        <div className="creator-mini">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <span className="avatar-fallback">U</span>}
          <div>
            <span className={profile.plan === "free" ? "tag" : "tag pro glow-badge"}>{profile.plan.toUpperCase()}</span>
            <h1>{profile.display_name || profile.email}</h1>
            <p className="helper">{profile.email}</p>
          </div>
        </div>
        <p className="helper big-helper">Free users can read 10 visual PDFs per day and download 1 PDF per day. Pro/Premium removes the free watermark layer and unlocks more pages.</p>
        <div className="card-actions">
          <a className="btn" href="/pricing">Upgrade plan</a>
          <button className="btn ghost" type="button" onClick={manageBilling}>Manage billing</button>
          <button className="btn ghost" type="button" onClick={logout}>Logout</button>
        </div>
        {message && <p className={message.includes("saved") ? "message success" : "message"}>{message}</p>}
      </section>

      <form className="admin-card pop-in delay-1" onSubmit={save}>
        <span className="badge">Profile editor</span>
        <h2>Edit your public profile</h2>
        <div className="form-grid single-form-grid">
          <label>
            Display name
            <input name="display_name" defaultValue={profile.display_name ?? ""} placeholder="Your name" />
          </label>
          <label>
            Avatar image URL
            <input name="avatar_url" defaultValue={profile.avatar_url ?? ""} placeholder="https://.../image.png" />
          </label>
          <label>
            Bio
            <textarea name="bio" defaultValue={profile.bio ?? ""} placeholder="Short bio..." />
          </label>
        </div>
        <button className="btn" type="submit">Save profile</button>
      </form>
    </main>
  );
}
