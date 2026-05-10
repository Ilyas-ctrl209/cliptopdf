export type UserPlan = "free" | "pro" | "premium" | "admin";
export type RequiredPlan = "free" | "pro" | "premium";

export type PdfItem = {
  id: string;
  video_id: string;
  youtube_url: string;
  title: string;
  category: string;
  creator_name: string | null;
  creator_user_id?: string | null;
  description: string | null;
  pdf_url: string | null;
  page_image_urls: string[] | null;
  thumbnail_url: string | null;
  copyright_image_url?: string | null;
  is_pro: boolean;
  required_plan?: RequiredPlan | null;
  download_count: number;
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
};
