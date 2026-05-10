# ClipToPDF Stripe + Admin Editor Update

This update adds:

- Free / Pro / Premium plans
- Stripe Checkout route for Pro and Premium subscriptions
- Stripe webhook route to update the user plan in Supabase
- Stripe customer portal route
- Account page with profile editing
- Admin password gate before the private admin editor opens
- Admin dashboard stats: pages, users, creators, requests, views today, downloads today
- Admin page editor: edit access level, title, category, creator, description, images, optional PDF, watermark
- Admin homepage editor: change hero title/subtitle and upload Recipe/Animal hero images
- Premium plan support on visual pages

## Required Vercel env vars

Keep your old vars and add:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
```

## Stripe webhook endpoint

Set this in Stripe Dashboard webhook endpoint:

```txt
https://cliptopdf.vercel.app/api/stripe/webhook
```

Recommended events:

- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

## Admin

Open:

```txt
https://cliptopdf.vercel.app/admin
```

Enter your Vercel `ADMIN_PASSWORD`.
