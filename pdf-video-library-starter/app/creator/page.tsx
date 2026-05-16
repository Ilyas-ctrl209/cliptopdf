"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { Category, PdfItem } from "@/lib/types";
import { extractYouTubeVideoId } from "@/lib/youtube";

type UserInfo = {
  email?: string;
  name?: string;
  avatar?: string;
  id?: string;
};

function accessLabel(pdf: PdfItem) {
  const required = pdf.required_plan ?? (pdf.is_pro ? "pro" : "free");
  return required === "premium" ? "Premium" : required === "pro" ? "Pro" : "Free";
}

function watermarkLabel(pdf: PdfItem) {
  const policy = pdf.watermark_policy ?? "after_first";
  if (policy === "none") return "No watermark";
  if (policy === "all") return "All pages watermarked";
  return "Page 1 clear, rest watermarked";
}

function coverSrc(pdf: PdfItem) {
  return pdf.cover_image_url || pdf.thumbnail_url || "";
}

function coverStyle(pdf: PdfItem) {
  return { objectPosition: pdf.cover_position || "center center" };
}

const coverPositions = [
  ["center center", "Center"],
  ["center top", "Top center"],
  ["center bottom", "Bottom center"],
  ["left center", "Left center"],
  ["right center", "Right center"],
  ["left top", "Top left"],
  ["right top", "Top right"],
  ["left bottom", "Bottom left"],
  ["right bottom", "Bottom right"]
] as const;

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
}

function fileListFromForm(formData: FormData, key: string) {
  return formData.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);
}

function optionalFileFromForm(formData: FormData, key: string) {
  const item = formData.get(key);
  return item instanceof File && item.size > 0 ? item : null;
}

async function uploadDirectFile(file: File, path: string) {
  const supabase = createSupabaseBrowserClient();
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "pdfs";
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream"
  });

  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadManyDirect(files: File[], basePath: string, setMessage: (message: string) => void) {
  const urls: string[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    setMessage(`Uploading page ${index + 1} of ${files.length} directly to storage...`);
    const path = `${basePath}/${String(index + 1).padStart(2, "0")}-${safeFileName(file.name)}`;
    urls.push(await uploadDirectFile(file, path));
  }
  return urls;
}

export default function CreatorPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [myPdfs, setMyPdfs] = useState<PdfItem[]>([]);
  const [selected, setSelected] = useState<PdfItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);


  async function loadCategories() {
    const response = await fetch("/api/categories", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setCategories(data.categories ?? []);
  }

  function categoryOptions(current?: string | null) {
    const list = [...categories];
    if (current && !list.some((category) => category.slug === current)) {
      list.push({ id: current, slug: current, label: current });
    }
    return list.length > 0 ? list : [
      { id: "recipe", slug: "recipe", label: "Recipe" },
      { id: "animal", slug: "animal", label: "Endangered animal" },
      { id: "hadith", slug: "hadith", label: "Hadith" },
      { id: "study", slug: "study", label: "Study notes" }
    ];
  }
  async function loadProfileUser(token: string, fallbackUser: any) {
    const fallback = {
      id: fallbackUser.id,
      email: fallbackUser.email ?? "",
      name: String(fallbackUser.user_metadata?.full_name ?? fallbackUser.user_metadata?.name ?? "Creator"),
      avatar: String(fallbackUser.user_metadata?.avatar_url ?? "")
    };
    try {
      const response = await fetch("/api/account/profile", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const data = await response.json();
      if (response.ok && data.profile) {
        return {
          id: fallbackUser.id,
          email: data.profile.email ?? fallback.email,
          name: data.profile.display_name || fallback.name,
          avatar: data.profile.avatar_url || fallback.avatar
        };
      }
    } catch {
      // Use the Google metadata fallback if profile loading is temporarily unavailable.
    }
    return fallback;
  }

  async function loadMyPdfs(token: string) {
    const response = await fetch("/api/creator/my-pdfs", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const data = await response.json();
    if (response.ok) setMyPdfs(data.pdfs ?? []);
  }

  useEffect(() => {
    let mounted = true;
    try {
      loadCategories();
      const supabase = createSupabaseBrowserClient();

      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        const session = data.session;
        const token = session?.access_token ?? null;
        setAccessToken(token);
        if (session?.user && token) {
          loadProfileUser(token, session.user).then((profileUser) => mounted && setUser(profileUser));
        } else {
          setUser(null);
        }
        setLoadingUser(false);
        if (token) loadMyPdfs(token);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        const token = session?.access_token ?? null;
        setAccessToken(token);
        if (session?.user && token) {
          loadProfileUser(token, session.user).then((profileUser) => mounted && setUser(profileUser));
        } else {
          setUser(null);
        }
        setLoadingUser(false);
        if (token) loadMyPdfs(token);
      });

      return () => {
        mounted = false;
        listener.subscription.unsubscribe();
      };
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Auth setup is missing.");
      setLoadingUser(false);
      return;
    }
  }, []);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken || !user) {
      setMessage("Please login first.");
      return;
    }

    setUploading(true);
    setMessage("Preparing upload...");

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const title = String(formData.get("title") ?? "").trim();
      const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
      const clipYoutubeUrl = String(formData.get("clipYoutubeUrl") ?? "").trim();
      const videoId = extractYouTubeVideoId(youtubeUrl);
      const clipVideoId = clipYoutubeUrl ? extractYouTubeVideoId(clipYoutubeUrl) : null;
      const pageImages = fileListFromForm(formData, "pageImages");
      const pdfFile = optionalFileFromForm(formData, "pdfFile");
      const copyrightImage = optionalFileFromForm(formData, "copyrightImage");
      const coverImage = optionalFileFromForm(formData, "coverImage");

      if (!title) throw new Error("Title is required.");
      if (!youtubeUrl) throw new Error("Original YouTube URL is required.");
      if (!videoId) throw new Error("Invalid original YouTube URL.");
      if (clipYoutubeUrl && !clipVideoId) throw new Error("Invalid ClipToPDF/short YouTube URL.");
      if (pageImages.length === 0) throw new Error("Upload at least one page image.");

      for (const image of pageImages) {
        if (image.type && !image.type.startsWith("image/")) throw new Error("Page images must be PNG, JPG, or WebP files.");
      }
      if (pdfFile && pdfFile.type && pdfFile.type !== "application/pdf") throw new Error("Optional PDF file must be a PDF.");
      if (copyrightImage && copyrightImage.type && !copyrightImage.type.startsWith("image/")) throw new Error("Copyright/watermark file must be an image.");
      if (coverImage && coverImage.type && !coverImage.type.startsWith("image/")) throw new Error("Card cover image must be an image.");

      const stamp = Date.now();
      const owner = user.id || "creator";
      const basePath = `creator-uploads/${owner}/${videoId}/${stamp}`;
      const pageImageUrls = await uploadManyDirect(pageImages, `${basePath}/pages`, setMessage);

      let pdfUrl: string | null = null;
      let copyrightImageUrl: string | null = null;
      let coverImageUrl: string | null = null;

      if (coverImage) {
        setMessage("Uploading special card cover directly to storage...");
        coverImageUrl = await uploadDirectFile(coverImage, `${basePath}/cover/${safeFileName(coverImage.name)}`);
      }

      if (copyrightImage) {
        setMessage("Uploading watermark image directly to storage...");
        copyrightImageUrl = await uploadDirectFile(copyrightImage, `${basePath}/copyright/${safeFileName(copyrightImage.name)}`);
      }

      if (pdfFile) {
        setMessage("Uploading optional PDF directly to storage...");
        pdfUrl = await uploadDirectFile(pdfFile, `${basePath}/pdf/${safeFileName(pdfFile.name)}`);
      }

      setMessage("Saving post details...");
      const response = await fetch("/api/creator/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          youtubeUrl,
          clipYoutubeUrl,
          category: String(formData.get("category") ?? "recipe"),
          creatorName: String(formData.get("creatorName") ?? ""),
          description: String(formData.get("description") ?? ""),
          requiredPlan: String(formData.get("requiredPlan") ?? "free"),
          watermarkPolicy: String(formData.get("watermarkPolicy") ?? "after_first"),
          coverPosition: String(formData.get("coverPosition") ?? "center center"),
          coverImageUrl,
          pageImageUrls,
          pdfUrl,
          copyrightImageUrl
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");

      setMessage(`Uploaded: ${data.pdf.title}`);
      form.reset();
      await loadMyPdfs(accessToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function updateSelected(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken || !selected || !user) return;
    setUploading(true);
    setMessage("Preparing update...");

    try {
      const formData = new FormData(e.currentTarget);
      const youtubeUrl = String(formData.get("youtubeUrl") ?? selected.youtube_url ?? "").trim();
      const videoId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : selected.video_id;
      const clipYoutubeUrl = String(formData.get("clipYoutubeUrl") ?? "").trim();
      const clipVideoId = clipYoutubeUrl ? extractYouTubeVideoId(clipYoutubeUrl) : null;
      const pageImages = fileListFromForm(formData, "pageImages");
      const pdfFile = optionalFileFromForm(formData, "pdfFile");
      const copyrightImage = optionalFileFromForm(formData, "copyrightImage");
      const coverImage = optionalFileFromForm(formData, "coverImage");

      if (youtubeUrl && !videoId) throw new Error("Invalid original YouTube URL.");
      if (clipYoutubeUrl && !clipVideoId) throw new Error("Invalid ClipToPDF/short YouTube URL.");

      const stamp = Date.now();
      const owner = user.id || "creator";
      const basePath = `creator-uploads/${owner}/${selected.video_id}/edit-${stamp}`;

      let pageImageUrls: string[] | undefined;
      let pdfUrl: string | undefined;
      let copyrightImageUrl: string | undefined;
      let coverImageUrl: string | undefined;

      if (pageImages.length > 0) {
        for (const image of pageImages) {
          if (image.type && !image.type.startsWith("image/")) throw new Error("Page images must be PNG, JPG, or WebP files.");
        }
        pageImageUrls = await uploadManyDirect(pageImages, `${basePath}/pages`, setMessage);
      }

      if (coverImage) {
        if (coverImage.type && !coverImage.type.startsWith("image/")) throw new Error("Card cover image must be an image.");
        setMessage("Uploading replacement card cover directly to storage...");
        coverImageUrl = await uploadDirectFile(coverImage, `${basePath}/cover/${safeFileName(coverImage.name)}`);
      }

      if (copyrightImage) {
        if (copyrightImage.type && !copyrightImage.type.startsWith("image/")) throw new Error("Copyright/watermark file must be an image.");
        setMessage("Uploading replacement watermark image directly to storage...");
        copyrightImageUrl = await uploadDirectFile(copyrightImage, `${basePath}/copyright/${safeFileName(copyrightImage.name)}`);
      }

      if (pdfFile) {
        if (pdfFile.type && pdfFile.type !== "application/pdf") throw new Error("PDF file must be a PDF.");
        setMessage("Uploading replacement PDF directly to storage...");
        pdfUrl = await uploadDirectFile(pdfFile, `${basePath}/pdf/${safeFileName(pdfFile.name)}`);
      }

      setMessage("Saving changes...");
      const response = await fetch("/api/creator/update-pdf", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: selected.id,
          title: String(formData.get("title") ?? selected.title),
          category: String(formData.get("category") ?? selected.category),
          creatorName: String(formData.get("creatorName") ?? selected.creator_name ?? ""),
          youtubeUrl,
          clipYoutubeUrl,
          description: String(formData.get("description") ?? ""),
          requiredPlan: String(formData.get("requiredPlan") ?? selected.required_plan ?? "free"),
          watermarkPolicy: String(formData.get("watermarkPolicy") ?? selected.watermark_policy ?? "after_first"),
          coverPosition: String(formData.get("coverPosition") ?? selected.cover_position ?? "center center"),
          coverImageUrl,
          pageImageUrls,
          pdfUrl,
          copyrightImageUrl
        })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Update failed.");

      setMessage(`Updated: ${data.pdf.title}`);
      setSelected(data.pdf);
      await loadMyPdfs(accessToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setUploading(false);
    }
  }

  if (loadingUser) {
    return <main className="container admin-wrap"><div className="panel">Checking login...</div></main>;
  }

  if (setupError) {
    return (
      <main className="container admin-wrap">
        <div className="panel">
          <span className="tag pro">Setup needed</span>
          <h1>Google login is not connected yet.</h1>
          <p className="helper">{setupError}</p>
          <p className="helper">Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container auth-wrap">
        <section className="auth-card">
          <span className="badge">Creator Studio</span>
          <h1>Login required</h1>
          <p className="helper big-helper">Login with Google first, then you can upload and edit your visual PDF pages.</p>
          <a className="btn" href="/login">Login with Google</a>
        </section>
      </main>
    );
  }

  return (
    <main className="container admin-wrap creator-layout">
      <section className="creator-panel panel">
        <div className="creator-mini">
          {user.avatar ? <img src={user.avatar} alt="Creator avatar" /> : <span className="avatar-fallback">C</span>}
          <div>
            <span className="badge">Creator account</span>
            <h1>{user.name}</h1>
            <p className="helper">{user.email}</p>
          </div>
        </div>
        <p className="helper big-helper">
          Upload page images first. The first image becomes the attractive cover. You can edit previous uploads below.
        </p>
        <button className="btn ghost" onClick={logout} type="button">Logout</button>
      </section>

      <section className="creator-main-stack">
        <form className="admin-card creator-form" onSubmit={submit}>
          <div className="section-title compact-title">
            <div>
              <span className="badge">Upload</span>
              <h2>Create visual PDF entry</h2>
            </div>
          </div>

          <div className="upload-note">
            New uploads go directly from your browser to Supabase Storage, so they should not get stuck on Vercel loading.
          </div>

          <div className="form-grid">
            <label className="full">Original creator YouTube link<input name="youtubeUrl" placeholder="Original video link from the creator" required /></label>
            <label className="full">Your ClipToPDF/short YouTube link <span className="helper">(optional — you can add it later)</span><input name="clipYoutubeUrl" placeholder="Your video link that promotes this PDF" /></label>
            <label>Title<input name="title" placeholder="Eggs with Tomato and Cheese" required /></label>
            <label>Category<select name="category" defaultValue="recipe">{categoryOptions().map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
            <label>Creator name / handle<input name="creatorName" placeholder="Example: @simpledeliciousrecipes" defaultValue={user.name ?? ""} /></label>
            <label>Card cover crop
              <select name="coverPosition" defaultValue="center center">
                {coverPositions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <span className="helper">Choose which part of page 1 appears in library cards.</span>
            </label>
            <label>Special card cover image<input type="file" name="coverImage" accept="image/png,image/jpeg,image/webp" /><span className="helper">Optional. Used only for cards/search results.</span></label>
            <label>Optional PDF file for download<input type="file" name="pdfFile" accept="application/pdf" /><span className="helper">Images are the main attraction. PDF is only for the download button.</span></label>
            <label>Custom free-user watermark image<input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" /><span className="helper">Optional. If empty, the admin default watermark is used.</span></label>
            <label className="full">Page images — upload page 1, page 2, page 3...<input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple required /><span className="helper">Use compressed JPG/WebP when possible. Big PNGs may still take time.</span></label>
            <label className="full">Description<textarea name="description" placeholder="Short description of this visual PDF..." /></label>
            <label>Access level<select name="requiredPlan" defaultValue="free"><option value="free">Free</option><option value="pro">Pro locked</option><option value="premium">Premium locked</option></select></label>
            <label>Free-user watermark rule<select name="watermarkPolicy" defaultValue="after_first"><option value="after_first">Page 1 clear, rest watermarked</option><option value="all">Watermark all pages</option><option value="none">No watermark on this page set</option></select></label>
          </div>

          <div className="card-actions">
            <button className="btn" type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload visual pages"}</button>
            <a className="btn ghost" href="/">Back home</a>
          </div>
          {message && <p className={message.includes("Uploaded") || message.includes("Updated") ? "message success" : "message error"}>{message}</p>}
        </form>

        <div className="admin-card creator-form creator-edit-box">
          <div className="section-title compact-title">
            <div>
              <span className="badge">My uploads</span>
              <h2>Edit previous work</h2>
            </div>
          </div>
          <div className="creator-upload-list">
            {myPdfs.length === 0 ? <p className="helper">No uploads yet.</p> : myPdfs.map((pdf) => (
              <button key={pdf.id} type="button" className={selected?.id === pdf.id ? "admin-page-row selected" : "admin-page-row"} onClick={() => setSelected(pdf)}>
                <img src={coverSrc(pdf)} style={coverStyle(pdf)} alt="" />
                <span><strong>{pdf.title}</strong><small>{accessLabel(pdf)} • {watermarkLabel(pdf)}</small></span>
              </button>
            ))}
          </div>

          {selected && (
            <form onSubmit={updateSelected} className="creator-edit-form">
              <h3>Edit: {selected.title}</h3>
              <div className="form-grid">
                <label>Title<input name="title" defaultValue={selected.title} /></label>
                <label>Category<select name="category" defaultValue={selected.category}>{categoryOptions(selected.category).map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
                <label>Creator name<input name="creatorName" defaultValue={selected.creator_name ?? ""} /></label>
                <label className="full">Original creator YouTube link<input name="youtubeUrl" defaultValue={selected.youtube_url ?? ""} /></label>
                <label className="full">Your ClipToPDF/short YouTube link <span className="helper">(optional)</span><input name="clipYoutubeUrl" defaultValue={selected.clip_youtube_url ?? ""} /></label>
                <label>Card cover crop
                  <select name="coverPosition" defaultValue={selected.cover_position ?? "center center"}>
                    {coverPositions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <span className="helper">Controls homepage/library crop.</span>
                </label>
                <label>Replace special card cover<input type="file" name="coverImage" accept="image/png,image/jpeg,image/webp" /></label>
                <label>Access level<select name="requiredPlan" defaultValue={selected.required_plan ?? (selected.is_pro ? "pro" : "free")}><option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option></select></label>
                <label>Free-user watermark rule<select name="watermarkPolicy" defaultValue={selected.watermark_policy ?? "after_first"}><option value="after_first">Page 1 clear, rest watermarked</option><option value="all">Watermark all pages</option><option value="none">No watermark on this page set</option></select></label>
                <label>Replace optional PDF<input type="file" name="pdfFile" accept="application/pdf" /></label>
                <label>Replace custom watermark<input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" /></label>
                <label className="full">Replace page images<input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple /></label>
                <label className="full">Description<textarea name="description" defaultValue={selected.description ?? ""} /></label>
              </div>
              <div className="card-actions">
                <button className="btn" type="submit" disabled={uploading}>{uploading ? "Saving..." : "Save changes"}</button>
                <a className="btn ghost" href={`/pdf/${selected.id}`} target="_blank">Preview</a>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
