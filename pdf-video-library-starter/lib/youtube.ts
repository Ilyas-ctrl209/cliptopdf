export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const value = input.trim();

  // Raw 11-character YouTube ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;

      const parts = url.pathname.split("/").filter(Boolean);
      const knownPaths = ["shorts", "embed", "live"];
      if (knownPaths.includes(parts[0]) && parts[1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[1])) {
        return parts[1];
      }
    }
  } catch {
    // Not a valid URL. Continue to regex fallback.
  }

  const regex = /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/;
  const match = value.match(regex);
  return match?.[1] ?? null;
}

export function youtubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}
