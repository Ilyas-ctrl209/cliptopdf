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
          redirectTo: `${window.location.origin}/account`
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
        <span className="badge">Free reader account</span>
        <h1>Sign up</h1>
        <p className="helper big-helper">
          Start as a normal free user. You can read 10 free visual PDFs per day, download 1 PDF per day, and upgrade later.
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
