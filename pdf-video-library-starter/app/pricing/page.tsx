"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    tag: "Reader account",
    cta: "Create free account",
    href: "/signup",
    features: [
      "Read 10 free visual PDFs per day",
      "Download 1 PDF file per day",
      "Creator copyright layer on page images",
      "Access free recipe, animal, hadith, and study pages"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$1.99/mo",
    tag: "Best starter upgrade",
    highlight: true,
    cta: "Upgrade to Pro",
    features: [
      "Unlimited free + Pro visual PDFs",
      "No free-user copyright overlay",
      "More PDF downloads",
      "PRO badge on your account"
    ]
  },
  {
    id: "premium",
    name: "Premium",
    price: "$2.99/mo",
    tag: "Full library access",
    cta: "Upgrade to Premium",
    features: [
      "Everything in Pro",
      "Unlock Premium visual PDFs",
      "Request new visual PDFs later",
      "Premium badge and full access"
    ]
  }
];

export default function PricingPage() {
  const [message, setMessage] = useState("");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function checkout(plan: "pro" | "premium") {
    setLoadingPlan(plan);
    setMessage("Checking your login...");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        window.location.href = "/login";
        return;
      }

      setMessage("Opening Stripe Checkout...");
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      const json = await response.json();
      if (!response.ok) {
        setMessage(json.error ?? "Stripe checkout is not ready yet.");
        setLoadingPlan(null);
        return;
      }
      window.location.href = json.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start checkout.");
      setLoadingPlan(null);
    }
  }

  return (
    <main className="container pricing-wrap">
      <section className="pricing-hero pop-in">
        <span className="badge">Pricing</span>
        <h1>Start free. Upgrade when you want the full library.</h1>
        <p className="helper big-helper">
          Free users can read 10 visual PDFs per day and download 1 PDF per day. Pro and Premium are connected to Stripe Checkout.
        </p>
        {message && <p className="message">{message}</p>}
      </section>

      <section className="pricing-grid">
        {plans.map((plan, index) => (
          <article className={`price-card pop-in ${plan.highlight ? "featured-price" : ""}`} style={{ animationDelay: `${index * 0.08}s` }} key={plan.name}>
            <span className={plan.id === "premium" ? "tag premium" : plan.highlight ? "tag pro" : "tag"}>{plan.tag}</span>
            <h2>{plan.name}</h2>
            <div className="price">{plan.price}</div>
            <ul>
              {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
            </ul>
            {plan.id === "free" ? (
              <a className="btn ghost" href={plan.href}>{plan.cta}</a>
            ) : (
              <button className={plan.id === "premium" ? "btn premium-btn" : "btn"} onClick={() => checkout(plan.id as "pro" | "premium")} disabled={loadingPlan === plan.id}>
                {loadingPlan === plan.id ? "Opening..." : plan.cta}
              </button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
