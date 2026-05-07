export type PdfItem = {
  id: string;
  video_id: string;
  youtube_url: string;
  title: string;
  category: string;
  creator_name: string | null;
  description: string | null;
  pdf_url: string;
  thumbnail_url: string | null;
  is_pro: boolean;
  download_count: number;
  created_at: string;
};
