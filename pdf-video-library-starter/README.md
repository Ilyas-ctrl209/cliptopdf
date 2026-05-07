# ClipToPDF Starter

A simple MVP website where users paste a YouTube link and find the matching PDF.

## What this includes

- Homepage with YouTube link search
- PDF library grid
- PDF result page with YouTube embed
- Admin upload page at `/admin`
- Supabase database and storage integration
- Request system when a PDF does not exist yet
- Free/Pro label support

## 1) Create the database

Open Supabase > SQL Editor > New query.
Paste everything from:

```txt
supabase/schema.sql
```

Then click **Run**.

## 2) Add environment variables

Create `.env.local` in the project root:

```env
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=pdfs
ADMIN_PASSWORD=choose-a-private-password
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Where to find them:

- `SUPABASE_URL`: Supabase Project Settings > API > Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Project Settings > API > service_role key

Never expose the service role key in client-side code.

## 3) Install and run locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

Admin upload page:

```txt
http://localhost:3000/admin
```

## 4) Upload your 12 PDFs

For every PDF:

1. Go to `/admin`
2. Paste the YouTube link
3. Add title, category, creator name
4. Upload the PDF
5. Choose Free or Pro
6. Click Upload PDF

## 5) Deploy on Vercel

Push this project to GitHub.
Then in Vercel:

1. Import the GitHub repo
2. Add the same environment variables in Project Settings > Environment Variables
3. Deploy

## Important copyright note

Use YouTube embed or source links. Do not download and re-upload parts of creators' videos unless you have permission or a clear legal basis.
