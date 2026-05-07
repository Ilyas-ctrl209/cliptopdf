# ClipToPDF Visual Creator Version

This version adds:

- Login and signup pages with Google OAuth through Supabase
- Creator Studio at `/creator`
- Upload page images so entries open as attractive images, not the browser PDF viewer
- Optional PDF file upload for downloading
- Public library cards using the first page image as the cover
- Admin hidden from the top bar, still available at `/admin`

## Required Vercel environment variables

```env
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=pdfs
ADMIN_PASSWORD=choose-a-private-password
NEXT_PUBLIC_SITE_URL=https://your-site.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

## Database

Run `supabase/schema.sql` in Supabase SQL Editor.

## Google login setup

In Supabase, enable Google under Authentication > Providers, then add your site URL to Authentication > URL Configuration / Redirect URLs.
