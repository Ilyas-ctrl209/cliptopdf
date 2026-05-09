const plans = [
  {
    name: "Free",
    price: "$0",
    tag: "Start reading",
    features: [
      "Read 10 free visual PDFs per day",
      "Download 1 PDF file per day",
      "Creator copyright layer on page images",
      "Access free recipe, animal, hadith, and study pages"
    ]
  },
  {
    name: "Single Pro",
    price: "$1.99/mo",
    tag: "Coming with Stripe",
    highlight: true,
    features: [
      "Unlimited free + premium visual PDFs",
      "More PDF downloads",
      "No free-user copyright overlay",
      "Save favorite pages later"
    ]
  },
  {
    name: "Premium",
    price: "$2.99/mo",
    tag: "Best for collectors",
    features: [
      "Everything in Single Pro",
      "Request new visual PDFs",
      "Early access collections",
      "Better downloadable files later"
    ]
  }
];

export default function PricingPage() {
  return (
    <main className="container pricing-wrap">
      <section className="pricing-hero pop-in">
        <span className="badge">Pricing</span>
        <h1>Free now. Pro later.</h1>
        <p className="helper big-helper">
          Stripe is not connected yet, so these plans are visual for now. Free users can read 10 visual PDFs per day and download 1 PDF per day.
        </p>
      </section>

      <section className="pricing-grid">
        {plans.map((plan, index) => (
          <article className={`price-card pop-in ${plan.highlight ? "featured-price" : ""}`} style={{ animationDelay: `${index * 0.08}s` }} key={plan.name}>
            <span className={plan.highlight ? "tag pro" : "tag"}>{plan.tag}</span>
            <h2>{plan.name}</h2>
            <div className="price">{plan.price}</div>
            <ul>
              {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
            </ul>
            <a className={plan.highlight ? "btn" : "btn ghost"} href={plan.name === "Free" ? "/signup" : "/signup"}>
              {plan.name === "Free" ? "Create free account" : "Join waitlist for Pro"}
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}
