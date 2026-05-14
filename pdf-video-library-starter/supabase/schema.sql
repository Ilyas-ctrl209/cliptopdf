-- ClipToPDF database update: roles, Pro/Premium subscriptions, admin editor, site settings, visual pages.
-- Safe to run again in Supabase SQL Editor.

create extension if not exists pgcrypto;


create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.categories (slug, label, is_active) values
  ('recipe', 'Recipe', true),
  ('animal', 'Endangered animal', true),
  ('hadith', 'Hadith', true),
  ('study', 'Study notes', true)
on conflict (slug) do update set label = excluded.label, is_active = true;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  bio text,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists stripe_customer_id text;
alter table public.user_profiles add column if not exists stripe_subscription_id text;
alter table public.user_profiles add column if not exists subscription_status text;
alter table public.user_profiles add column if not exists subscription_current_period_end timestamptz;
alter table public.user_profiles add column if not exists bio text;
alter table public.user_profiles add column if not exists avatar_url text;

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%plan%'
  loop
    execute format('alter table public.user_profiles drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.user_profiles
  add constraint user_profiles_plan_check check (plan in ('free','pro','premium','admin'));

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
  clip_video_id text,
  clip_youtube_url text,
  title text not null,
  category text not null default 'recipe',
  creator_name text,
  creator_user_id uuid references auth.users(id) on delete set null,
  description text,
  pdf_url text,
  page_image_urls jsonb not null default '[]'::jsonb,
  thumbnail_url text,
  cover_image_url text,
  cover_position text not null default 'center center',
  copyright_image_url text,
  watermark_policy text not null default 'after_first',
  required_plan text not null default 'free',
  is_pro boolean not null default false,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.pdfs add column if not exists creator_user_id uuid references auth.users(id) on delete set null;
alter table public.pdfs add column if not exists clip_video_id text;
alter table public.pdfs add column if not exists clip_youtube_url text;
create unique index if not exists pdfs_clip_video_id_unique on public.pdfs (clip_video_id) where clip_video_id is not null;
alter table public.pdfs add column if not exists page_image_urls jsonb not null default '[]'::jsonb;
alter table public.pdfs add column if not exists cover_image_url text;
alter table public.pdfs add column if not exists cover_position text not null default 'center center';
alter table public.pdfs add column if not exists copyright_image_url text;
alter table public.pdfs add column if not exists watermark_policy text not null default 'after_first';
alter table public.pdfs add column if not exists required_plan text not null default 'free';
alter table public.pdfs alter column pdf_url drop not null;
update public.pdfs set required_plan = 'pro' where is_pro = true and required_plan = 'free';

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.pdfs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%required_plan%'
  loop
    execute format('alter table public.pdfs drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.pdfs
  add constraint pdfs_required_plan_check check (required_plan in ('free','pro','premium'));

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.pdfs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%watermark_policy%'
  loop
    execute format('alter table public.pdfs drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.pdfs
  add constraint pdfs_watermark_policy_check check (watermark_policy in ('none','after_first','all'));


create table if not exists public.user_pdf_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pdf_id uuid not null references public.pdfs(id) on delete cascade,
  view_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, pdf_id, view_date)
);



create table if not exists public.pdf_view_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  pdf_id uuid not null references public.pdfs(id) on delete cascade,
  viewer_plan text,
  view_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists pdf_view_events_pdf_id_idx on public.pdf_view_events (pdf_id);
create index if not exists pdf_view_events_view_date_idx on public.pdf_view_events (view_date);

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

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value)
values ('home', jsonb_build_object(
  'hero_title', 'Make scrolling feel like reading again.',
  'hero_subtitle', 'Paste a YouTube link and open the visual PDF version instantly.',
  'default_watermark_image_url', null
))
on conflict (key) do nothing;

alter table public.categories enable row level security;
alter table public.pdfs enable row level security;
alter table public.pdf_requests enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_pdf_views enable row level security;
alter table public.pdf_view_events enable row level security;
alter table public.user_pdf_downloads enable row level security;
alter table public.site_settings enable row level security;

-- Public/basic read policies. Server API uses service role for private/admin actions.


do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'Public can read active categories') then
    create policy "Public can read active categories" on public.categories for select using (is_active = true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pdfs' and policyname = 'Public can read PDFs') then
    create policy "Public can read PDFs" on public.pdfs for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'creator_profiles' and policyname = 'Public can read creator profiles') then
    create policy "Public can read creator profiles" on public.creator_profiles for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Users can read profiles') then
    create policy "Users can read profiles" on public.user_profiles for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'Users can update own profile') then
    create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'site_settings' and policyname = 'Public can read site settings') then
    create policy "Public can read site settings" on public.site_settings for select using (true);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do update set public = true;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public can read PDF bucket') then
    create policy "Public can read PDF bucket" on storage.objects for select using (bucket_id = 'pdfs');
  end if;
end $$;

-- Manual admin/pro backup if Stripe webhook is not done yet:
-- update public.user_profiles set plan = 'admin' where email = 'your-email@gmail.com';
-- update public.user_profiles set plan = 'pro' where email = 'your-email@gmail.com';
-- update public.user_profiles set plan = 'premium' where email = 'your-email@gmail.com';

-- Direct creator uploads from browser to Supabase Storage.
-- Needed after the fast upload update. Safe to run again.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated creators can upload to PDF bucket') then
    create policy "Authenticated creators can upload to PDF bucket" on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'pdfs');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated creators can update PDF bucket objects') then
    create policy "Authenticated creators can update PDF bucket objects" on storage.objects
      for update
      to authenticated
      using (bucket_id = 'pdfs')
      with check (bucket_id = 'pdfs');
  end if;
end $$;
