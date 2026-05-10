import { NextResponse } from "next/server";
import { ensureUserProfile, requireUser } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPlanPriceId, getStripe } from "@/lib/stripe";

type CheckoutPlan = "pro" | "premium";

export async function POST(request: Request) {
  const required = await requireUser(request);
  if ("error" in required) return required.error;

  const body = await request.json().catch(() => ({}));
  const plan = String(body.plan ?? "") as CheckoutPlan;
  if (plan !== "pro" && plan !== "premium") {
    return NextResponse.json({ error: "Choose pro or premium." }, { status: 400 });
  }

  const priceId = getPlanPriceId(plan);
  if (!priceId) {
    return NextResponse.json({ error: `${plan.toUpperCase()} Stripe price ID is missing in Vercel.` }, { status: 500 });
  }

  const profile = await ensureUserProfile(required.user);
  const stripe = getStripe();
  let customerId = profile.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: required.user.email ?? undefined,
      name: profile.display_name ?? undefined,
      metadata: { user_id: required.user.id }
    });
    customerId = customer.id;
    await supabaseAdmin
      .from("user_profiles")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", required.user.id);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${siteUrl}/account?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
    metadata: {
      user_id: required.user.id,
      plan
    },
    subscription_data: {
      metadata: {
        user_id: required.user.id,
        plan
      }
    }
  });

  return NextResponse.json({ url: session.url });
}
