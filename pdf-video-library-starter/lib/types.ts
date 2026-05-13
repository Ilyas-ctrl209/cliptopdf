export type UserPlan = "free" | "pro" | "premium" | "admin";
export type RequiredPlan = "free" | "pro" | "premium";
export type WatermarkPolicy = "none" | "after_first" | "all";

export type PdfItem = {
  id: string;
  video_id: string;
  youtube_url: string;
  clip_video_id?: string | null;
  clip_youtube_url?: string | null;
  title: string;
  category: string;
  creator_name: string | null;
  creator_user_id?: string | null;
  description: string | null;
  pdf_url: string | null;
  page_image_urls: string[] | null;
  thumbnail_url: string | null;
  copyright_image_url?: string | null;
  watermark_policy?: WatermarkPolicy | null;
  is_pro: boolean;
  required_plan?: RequiredPlan | null;
  download_count: number;
  total_views?: number;
  created_at: string;
};

export type AppUserProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  plan: UserPlan;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
  created_at: string;
};

export type SiteSettings = {
  hero_title?: string;
  hero_subtitle?: string;
  recipe_hero_image_url?: string;
  animal_hero_image_url?: string;
  default_watermark_image_url?: string;
};


export type Category = {
  id: string;
  slug: string;
  label: string;
  created_at?: string;
};
