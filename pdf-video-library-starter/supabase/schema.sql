-- Run this in Supabase SQL Editor.
-- Safe to run again. Adds visual PDF pages, creators, normal/free/pro user profiles, daily limits, and free-user watermark support.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  bio text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  bio text,
  is_approved boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pdfs (
  id uuid primary key default gen_random_uuid(),
  video_id text not null unique,
  youtube_url text not null,
  title text not null,
  category text not null default 'recipe',
  creator_name text,
  creator_user_id uuid references auth.users(id) on delete set null,
  description text,
  pdf_url text,
  page_image_urls jsonb not null default '[]'::jsonb,
  thumbnail_url text,
  copyright_image_url text,
  is_pro boolean not null default false,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.pdfs add column if not exists creator_user_id uuid references auth.users(id) on delete set null;
alter table public.pdfs add column if not exists page_image_urls jsonb not null default '[]'::jsonb;
alter table public.pdfs add column if not exists copyright_image_url text;
alter table public.pdfs alter column pdf_url drop not null;

create table if not exists public.user_pdf_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pdf_id uuid not null references public.pdfs(id) on delete cascade,
  view_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, pdf_id, view_date)
);

create table if not exists public.user_pdf_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pdf_id uuid not null references public.pdfs(id) on delete cascade,
  download_date date not null default current_date,
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
alter table public.creator_profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_pdf_views enable row level security;
alter table public.user_pdf_downloads enable row level security;

-- Public can read PDF list, creator profiles, and basic public user profile info.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pdfs' and policyname = 'Public can read PDFs'
  ) then
    create policy "Public can read PDFs" on public.pdfs
      for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'creator_profiles' and policyname = 'Public can read creator profiles'
  ) then
    create policy "Public can read creator profiles" on public.creator_profiles
      for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Users can read profiles'
  ) then
    create policy "Users can read profiles" on public.user_profiles
      for select using (true);
  end if;
end $$;

-- Users can edit their own profile later. Server/service role can still manage everything.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile" on public.user_profiles
      for update using (auth.uid() = user_id);
  end if;
end $$;

-- Create a public bucket called "pdfs" for PDFs, page images, and watermark images.
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

-- Manual admin note:
-- To manually make yourself Pro later, run:
-- update public.user_profiles set plan = 'pro' where email = 'your-email@gmail.com';
-- To manually make yourself Admin later, run:
-- update public.user_profiles set plan = 'admin' where email = 'your-email@gmail.com';
