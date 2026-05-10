"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const [message, setMessage] = useState("");

  async function continueWithGoogle() {
    setMessage("Opening Google login...");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/account`
        }
      });
      if (error) setMessage(error.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login setup is missing.");
    }
  }

  return (
    <main className="container auth-wrap">
      <section className="auth-card float-in">
        <span className="badge">Reader account</span>
        <h1>Login</h1>
        <p className="helper big-helper">
          Use Google to read free visual PDFs, upgrade to Pro/Premium, or open Creator Studio later.
        </p>
        <button className="google-btn" onClick={continueWithGoogle} type="button">
          <span className="google-dot">G</span>
          Continue with Google
        </button>
        <a className="small-link" href="/signup">Need an account? Sign up</a>
        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}
