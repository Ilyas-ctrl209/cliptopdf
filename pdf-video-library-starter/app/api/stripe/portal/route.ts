import { NextResponse } from "next/server";
import { ensureUserProfile, requireUser } from "@/lib/authHelpers";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const required = await requireUser(request);
  if ("error" in required) return required.error;

  const profile = await ensureUserProfile(required.user);
  if (!profile.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer found yet. Subscribe first." }, { status: 400 });
  }

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl}/account`
  });

  return NextResponse.json({ url: session.url });
}
