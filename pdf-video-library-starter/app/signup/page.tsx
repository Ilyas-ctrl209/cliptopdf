"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function SignupPage() {
  const [message, setMessage] = useState("");

  async function continueWithGoogle() {
    setMessage("Opening Google signup...");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/creator`
        }
      });
      if (error) setMessage(error.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signup setup is missing.");
    }
  }

  return (
    <main className="container auth-wrap">
      <section className="auth-card float-in">
        <span className="badge">Start uploading</span>
        <h1>Sign up</h1>
        <p className="helper big-helper">
          Create a creator account. Later, creators can upload their own recipe PDFs, animal PDFs, hadith notes, and collections.
        </p>
        <button className="google-btn" onClick={continueWithGoogle} type="button">
          <span className="google-dot">G</span>
          Continue with Google
        </button>
        <a className="small-link" href="/login">Already have an account? Login</a>
        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}
