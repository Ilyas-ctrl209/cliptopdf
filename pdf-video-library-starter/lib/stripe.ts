import Stripe from "stripe";

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is missing.");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export function getPlanPriceId(plan: string) {
  if (plan === "premium") return process.env.STRIPE_PREMIUM_PRICE_ID;
  if (plan === "pro") return process.env.STRIPE_PRO_PRICE_ID;
  return null;
}

export function planFromPriceId(priceId?: string | null) {
  if (priceId && priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return "premium";
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return null;
}
