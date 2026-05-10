import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStripe, planFromPriceId } from "@/lib/stripe";

function stripeId(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function updateProfileFromSubscription(subscription: Stripe.Subscription) {
  const customerId = stripeId(subscription.customer as string | Stripe.Customer | null);
  const subscriptionId = subscription.id;
  const itemPriceId = subscription.items.data[0]?.price?.id ?? null;
  const planFromPrice = planFromPriceId(itemPriceId);
  const planFromMetadata = subscription.metadata?.plan === "premium" ? "premium" : subscription.metadata?.plan === "pro" ? "pro" : null;
  const paid = ["active", "trialing"].includes(subscription.status);
  const newPlan = paid ? (planFromPrice ?? planFromMetadata ?? "pro") : "free";
  const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  const currentPeriodEnd = typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null;

  let query = supabaseAdmin.from("user_profiles").update({
    plan: newPlan,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: subscription.status,
    subscription_current_period_end: currentPeriodEnd
  });

  if (subscription.metadata?.user_id) {
    query = query.eq("user_id", subscription.metadata.user_id);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    return;
  }

  await query;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is missing." }, { status: 500 });
  }

  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan === "premium" ? "premium" : "pro";
      const subscriptionId = stripeId(session.subscription as string | Stripe.Subscription | null);
      const customerId = stripeId(session.customer as string | Stripe.Customer | null);

      if (userId) {
        await supabaseAdmin
          .from("user_profiles")
          .update({
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "active"
          })
          .eq("user_id", userId);
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      await updateProfileFromSubscription(event.data.object as Stripe.Subscription);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from("user_profiles")
        .update({
          plan: "free",
          subscription_status: subscription.status,
          stripe_subscription_id: subscription.id
        })
        .eq("stripe_subscription_id", subscription.id);
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook handling failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
