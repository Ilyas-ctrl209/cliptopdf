-- Run this in Supabase SQL Editor one time.
-- It creates your PDF library table, request table, and public PDF storage bucket.

create extension if not exists pgcrypto;

create table if not exists public.pdfs (
  id uuid primary key default gen_random_uuid(),
  video_id text not null unique,
  youtube_url text not null,
  title text not null,
  category text not null default 'recipe',
  creator_name text,
  description text,
  pdf_url text not null,
  thumbnail_url text,
  is_pro boolean not null default false,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pdf_requests (
  id uuid primary key default gen_random_uuid(),
  youtube_url text not null,
  video_id text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.pdfs enable row level security;
alter table public.pdf_requests enable row level security;

-- Public can read the PDF list. Writing is done through your server route with service role key.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pdfs' and policyname = 'Public can read PDFs'
  ) then
    create policy "Public can read PDFs" on public.pdfs
      for select using (true);
  end if;
end $$;

-- Create a public bucket called "pdfs".
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do update set public = true;

-- Allow public reading from the public bucket.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public can read PDF bucket'
  ) then
    create policy "Public can read PDF bucket" on storage.objects
      for select using (bucket_id = 'pdfs');
  end if;
end $$;
