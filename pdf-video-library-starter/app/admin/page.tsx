"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { extractYouTubeVideoId } from "@/lib/youtube";
import type { Category, PdfItem, SiteSettings } from "@/lib/types";

type Stats = {
  pdfCount: number;
  userCount: number;
  creatorCount: number;
  requestCount: number;
  viewsToday: number;
  downloadsToday: number;
};

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  subscription_status: string | null;
  created_at: string;
};

function accessLabel(pdf: PdfItem) {
  const required = pdf.required_plan ?? (pdf.is_pro ? "pro" : "free");
  return required === "premium" ? "Premium" : required === "pro" ? "Pro" : "Free";
}

function pageCount(pdf: PdfItem) {
  return Array.isArray(pdf.page_image_urls) ? pdf.page_image_urls.length : 0;
}

function watermarkLabel(pdf: PdfItem) {
  const policy = pdf.watermark_policy ?? "after_first";
  if (policy === "none") return "No free watermark";
  if (policy === "all") return "Watermark all pages";
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

type UploadProgressItem = {
  name: string;
  progress: number;
  status: "waiting" | "uploading" | "done" | "error";
};

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
}

function filesFromForm(formData: FormData, key: string) {
  return formData.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);
}

function optionalFileFromForm(formData: FormData, key: string) {
  const item = formData.get(key);
  return item instanceof File && item.size > 0 ? item : null;
}

function copyTextFields(formData: FormData, names: string[]) {
  const clean = new FormData();
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") clean.set(name, value);
  }
  return clean;
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

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [selected, setSelected] = useState<PdfItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "homepage" | "pages" | "upload" | "categories" | "users">("overview");
  const [uploadProgress, setUploadProgress] = useState<{ label: string; items: UploadProgressItem[] } | null>(null);

  async function loadDashboard(pass = password) {
    setLoading(true);
    setMessage("Loading admin editor...");
    const response = await fetch("/api/admin/dashboard", {
      headers: { "x-admin-password": pass },
      cache: "no-store"
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error ?? "Wrong password.");
      setUnlocked(false);
      return;
    }
    setUnlocked(true);
    setStats(data.stats);
    setPdfs(data.pdfs ?? []);
    setUsers(data.users ?? []);
    setSettings(data.settings ?? {});
    setCategories(data.categories ?? []);
    setMessage("Admin editor opened.");
  }

  async function unlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    sessionStorage.setItem("cliptopdf_admin_password", password);
    await loadDashboard(password);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("cliptopdf_admin_password");
    if (saved) {
      setPassword(saved);
      loadDashboard(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function saveCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Saving category...");
    const formData = new FormData(e.currentTarget);
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, action: "add", label: String(formData.get("label") ?? ""), slug: String(formData.get("slug") ?? "") })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not save category.");
      return;
    }
    setCategories(data.categories ?? []);
    setMessage("Category saved.");
    e.currentTarget.reset();
  }

  async function deleteCategory(id: string) {
    const ok = window.confirm("Remove this category from the dropdown? Existing pages keep their category text.");
    if (!ok) return;
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, action: "delete", id })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not remove category.");
      return;
    }
    setCategories(data.categories ?? []);
    setMessage("Category removed from dropdown.");
  }

  function setProgressStart(label: string, files: File[]) {
    setUploadProgress({
      label,
      items: files.map((file) => ({ name: file.name, progress: 0, status: "waiting" }))
    });
  }

  function setProgressItem(index: number, progress: number, status: UploadProgressItem["status"] = "uploading") {
    setUploadProgress((current) => current ? {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, progress, status } : item)
    } : current);
  }

  async function uploadFilesWithProgress(files: File[], basePath: string, label: string) {
    setProgressStart(label, files);
    const urls: string[] = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      setMessage(`${label}: uploading ${index + 1} of ${files.length}...`);
      setProgressItem(index, 15, "uploading");
      const url = await uploadDirectFile(file, `${basePath}/${String(index + 1).padStart(2, "0")}-${Date.now()}-${safeFileName(file.name)}`);
      urls.push(url);
      setProgressItem(index, 100, "done");
    }
    return urls;
  }

  async function uploadOptionalFileWithProgress(file: File | null, path: string, label: string) {
    if (!file) return null;
    setProgressStart(label, [file]);
    setProgressItem(0, 25, "uploading");
    setMessage(`${label}: uploading...`);
    const url = await uploadDirectFile(file, `${path}/${Date.now()}-${safeFileName(file.name)}`);
    setProgressItem(0, 100, "done");
    return url;
  }

  async function saveHomepage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Preparing homepage save...");
    const formData = new FormData(e.currentTarget);
    const cleanData = copyTextFields(formData, ["heroTitle", "heroSubtitle"]);
    cleanData.set("password", password);

    try {
      const recipeHeroImage = optionalFileFromForm(formData, "recipeHeroImage");
      const animalHeroImage = optionalFileFromForm(formData, "animalHeroImage");
      const defaultWatermarkImage = optionalFileFromForm(formData, "defaultWatermarkImage");
      const allFiles = [recipeHeroImage, animalHeroImage, defaultWatermarkImage].filter((file): file is File => Boolean(file));

      if (allFiles.length > 0) setProgressStart("Uploading homepage images", allFiles);
      let progressIndex = 0;
      if (recipeHeroImage) {
        setProgressItem(progressIndex, 20, "uploading");
        cleanData.set("recipeHeroImageUrl", await uploadDirectFile(recipeHeroImage, `site/recipe-${Date.now()}-${safeFileName(recipeHeroImage.name)}`));
        setProgressItem(progressIndex, 100, "done");
        progressIndex++;
      }
      if (animalHeroImage) {
        setProgressItem(progressIndex, 20, "uploading");
        cleanData.set("animalHeroImageUrl", await uploadDirectFile(animalHeroImage, `site/animal-${Date.now()}-${safeFileName(animalHeroImage.name)}`));
        setProgressItem(progressIndex, 100, "done");
        progressIndex++;
      }
      if (defaultWatermarkImage) {
        setProgressItem(progressIndex, 20, "uploading");
        cleanData.set("defaultWatermarkImageUrl", await uploadDirectFile(defaultWatermarkImage, `site/default-watermark-${Date.now()}-${safeFileName(defaultWatermarkImage.name)}`));
        setProgressItem(progressIndex, 100, "done");
      }

      setMessage("Saving homepage settings...");
      const response = await fetch("/api/admin/site-settings", { method: "POST", body: cleanData });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not save homepage.");
        return;
      }
      setSettings(data.settings ?? {});
      setMessage("Homepage saved. Refresh home page to see the new images.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload homepage images.");
    } finally {
      setTimeout(() => setUploadProgress(null), 1200);
    }
  }

  async function uploadNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Preparing direct upload...");
    const form = e.currentTarget;
    const formData = new FormData(form);
    const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
    const videoId = extractYouTubeVideoId(youtubeUrl);
    const pageImages = filesFromForm(formData, "pageImages");
    const coverImage = optionalFileFromForm(formData, "coverImage");
    const pdfFile = optionalFileFromForm(formData, "pdfFile");
    const copyrightImage = optionalFileFromForm(formData, "copyrightImage");

    if (!videoId) {
      setMessage("Invalid original YouTube URL.");
      return;
    }
    if (pageImages.length === 0) {
      setMessage("Upload at least one page image.");
      return;
    }

    const cleanData = copyTextFields(formData, ["youtubeUrl", "clipYoutubeUrl", "title", "category", "creatorName", "coverPosition", "requiredPlan", "watermarkPolicy", "description"]);
    cleanData.set("password", password);
    cleanData.set("requiredPlan", String(formData.get("requiredPlan") ?? "free"));

    try {
      const basePath = `admin-uploads/${videoId}/${Date.now()}`;
      const pageImageUrls = await uploadFilesWithProgress(pageImages, `${basePath}/pages`, "Uploading page images");
      cleanData.set("pageImageUrls", JSON.stringify(pageImageUrls));

      const coverImageUrl = await uploadOptionalFileWithProgress(coverImage, `${basePath}/cover`, "Uploading card cover");
      if (coverImageUrl) cleanData.set("coverImageUrl", coverImageUrl);

      const copyrightImageUrl = await uploadOptionalFileWithProgress(copyrightImage, `${basePath}/copyright`, "Uploading watermark");
      if (copyrightImageUrl) cleanData.set("copyrightImageUrl", copyrightImageUrl);

      const pdfUrl = await uploadOptionalFileWithProgress(pdfFile, `${basePath}/pdf`, "Uploading optional PDF");
      if (pdfUrl) cleanData.set("pdfUrl", pdfUrl);

      setMessage("Saving post details...");
      const response = await fetch("/api/admin/create-pdf", { method: "POST", body: cleanData });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Upload failed.");
        return;
      }
      setMessage(`Uploaded: ${data.pdf.title}`);
      form.reset();
      setPdfs((items) => [data.pdf, ...items.filter((item) => item.id !== data.pdf.id)]);
      setStats((current) => current ? { ...current, pdfCount: current.pdfCount + 1 } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setTimeout(() => setUploadProgress(null), 1200);
    }
  }

  async function updateSelected(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setMessage("Preparing page update...");
    const formData = new FormData(e.currentTarget);
    const cleanData = copyTextFields(formData, ["title", "category", "creatorName", "youtubeUrl", "clipYoutubeUrl", "coverPosition", "requiredPlan", "watermarkPolicy", "description"]);
    cleanData.set("password", password);
    cleanData.set("id", selected.id);

    try {
      const baseId = extractYouTubeVideoId(String(formData.get("youtubeUrl") ?? selected.youtube_url ?? "")) || selected.video_id || selected.id;
      const basePath = `admin-updates/${baseId}/${Date.now()}`;
      const pageImages = filesFromForm(formData, "pageImages");
      const coverImage = optionalFileFromForm(formData, "coverImage");
      const pdfFile = optionalFileFromForm(formData, "pdfFile");
      const copyrightImage = optionalFileFromForm(formData, "copyrightImage");

      if (pageImages.length > 0) {
        const pageImageUrls = await uploadFilesWithProgress(pageImages, `${basePath}/pages`, "Replacing page images");
        cleanData.set("pageImageUrls", JSON.stringify(pageImageUrls));
      }

      const coverImageUrl = await uploadOptionalFileWithProgress(coverImage, `${basePath}/cover`, "Replacing card cover");
      if (coverImageUrl) cleanData.set("coverImageUrl", coverImageUrl);

      const copyrightImageUrl = await uploadOptionalFileWithProgress(copyrightImage, `${basePath}/copyright`, "Replacing watermark");
      if (copyrightImageUrl) cleanData.set("copyrightImageUrl", copyrightImageUrl);

      const pdfUrl = await uploadOptionalFileWithProgress(pdfFile, `${basePath}/pdf`, "Replacing optional PDF");
      if (pdfUrl) cleanData.set("pdfUrl", pdfUrl);

      setMessage("Saving page details...");
      const response = await fetch("/api/admin/update-pdf", { method: "POST", body: cleanData });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Update failed.");
        return;
      }
      setMessage(`Updated: ${data.pdf.title}`);
      setSelected(data.pdf);
      setPdfs((items) => items.map((item) => item.id === data.pdf.id ? data.pdf : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setTimeout(() => setUploadProgress(null), 1200);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    const ok = window.confirm(`Delete ${selected.title}? This removes it from the database.`);
    if (!ok) return;
    setMessage("Deleting page...");
    const response = await fetch("/api/admin/delete-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, id: selected.id })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Delete failed.");
      return;
    }
    setSelected(null);
    setMessage("Page deleted.");
    await loadDashboard();
  }

  if (!unlocked) {
    return (
      <main className="container auth-wrap">
        <form className="auth-card admin-lock-card pop-in" onSubmit={unlock}>
          <span className="badge">Admin lock</span>
          <h1>Enter admin password.</h1>
          <p className="helper big-helper">This opens the private editor where you can edit homepage images, pages, users, pricing setup, and uploads.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ADMIN_PASSWORD" required />
          <button className="btn" type="submit" disabled={loading}>{loading ? "Checking..." : "Open admin editor"}</button>
          {message && <p className="message error">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="container admin-wrap admin-editor">
      <section className="section-title compact-title">
        <div>
          <span className="badge">Admin editor</span>
          <h1>Control the whole site</h1>
        </div>
        <div className="card-actions">
          <button className="btn ghost" onClick={() => loadDashboard()} disabled={loading}>Refresh</button>
          <a className="btn ghost" href="/">View site</a>
        </div>
      </section>

      {message && <p className={message.includes("failed") || message.includes("Wrong") || message.includes("Could") ? "message error" : "message success"}>{message}</p>}

      {uploadProgress && (
        <div className="upload-progress-card pop-in">
          <strong>{uploadProgress.label}</strong>
          <div className="upload-progress-list">
            {uploadProgress.items.map((item, index) => (
              <div className="upload-progress-item" key={`${item.name}-${index}`}>
                <div className="upload-progress-head"><span>{item.name}</span><small>{item.status === "done" ? "Done" : `${item.progress}%`}</small></div>
                <div className="progress-track"><span style={{ width: `${item.progress}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-tabs">
        {(["overview", "homepage", "pages", "upload", "categories", "users"] as const).map((tab) => (
          <button key={tab} className={activeTab === tab ? "tab active" : "tab"} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <section className="stats-grid pop-in">
          <div className="stat-card"><span>Total pages</span><strong>{stats?.pdfCount ?? 0}</strong></div>
          <div className="stat-card"><span>Users</span><strong>{stats?.userCount ?? 0}</strong></div>
          <div className="stat-card"><span>Creators</span><strong>{stats?.creatorCount ?? 0}</strong></div>
          <div className="stat-card"><span>Requests</span><strong>{stats?.requestCount ?? 0}</strong></div>
          <div className="stat-card"><span>Views today</span><strong>{stats?.viewsToday ?? 0}</strong></div>
          <div className="stat-card"><span>Downloads today</span><strong>{stats?.downloadsToday ?? 0}</strong></div>
        </section>
      )}

      {activeTab === "homepage" && (
        <form className="admin-card pop-in" onSubmit={saveHomepage}>
          <span className="badge">Homepage editor</span>
          <h2>Hero text and card images</h2>
          <div className="form-grid">
            <label className="full">Hero title<input name="heroTitle" defaultValue={settings.hero_title ?? "Make scrolling feel like reading again."} /></label>
            <label className="full">Hero subtitle<textarea name="heroSubtitle" defaultValue={settings.hero_subtitle ?? "Paste a YouTube link and open the visual PDF version instantly."} /></label>
            <label>Recipe PDF card image<input type="file" name="recipeHeroImage" accept="image/png,image/jpeg,image/webp" /></label>
            <label>Animal PDF card image<input type="file" name="animalHeroImage" accept="image/png,image/jpeg,image/webp" /></label>
            <label>Default free-user watermark image<input type="file" name="defaultWatermarkImage" accept="image/png,image/jpeg,image/webp" /><span className="helper">Used when a page does not have its own watermark uploaded.</span></label>
          </div>
          <div className="settings-preview">
            {settings.recipe_hero_image_url && <img src={settings.recipe_hero_image_url} alt="Recipe hero" />}
            {settings.animal_hero_image_url && <img src={settings.animal_hero_image_url} alt="Animal hero" />}
            {settings.default_watermark_image_url && <img src={settings.default_watermark_image_url} alt="Default watermark" />}
          </div>
          <button className="btn" type="submit">Save homepage</button>
        </form>
      )}

      {activeTab === "pages" && (
        <section className="admin-split pop-in">
          <div className="panel page-list-panel">
            <h2>All visual pages ({pdfs.length})</h2>
            <div className="admin-page-list">
              {pdfs.map((pdf) => (
                <button className={selected?.id === pdf.id ? "admin-page-row selected" : "admin-page-row"} key={pdf.id} onClick={() => setSelected(pdf)}>
                  <img src={coverSrc(pdf)} style={coverStyle(pdf)} alt="" />
                  <span><strong>{pdf.title}</strong><small>{accessLabel(pdf)} • {pdf.category} • {pageCount(pdf)} images • {pdf.total_views ?? 0} views • {watermarkLabel(pdf)}</small></span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel page-editor-panel">
            {!selected ? <p className="helper">Choose a page from the list to edit it.</p> : (
              <form onSubmit={updateSelected}>
                <span className={accessLabel(selected) === "Premium" ? "tag premium" : accessLabel(selected) === "Pro" ? "tag pro" : "tag"}>{accessLabel(selected)}</span>
                <h2>Edit page</h2>
                <p className="helper">Total views tracked: {selected.total_views ?? 0}</p>
                {coverSrc(selected) && <img className="admin-cover-preview" src={coverSrc(selected)} style={coverStyle(selected)} alt="Current card cover" />}
                <div className="form-grid single-form-grid">
                  <label>Title<input name="title" defaultValue={selected.title} /></label>
                  <label>Category<select name="category" defaultValue={selected.category}>{categoryOptions(selected.category).map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
                  <label>Creator name<input name="creatorName" defaultValue={selected.creator_name ?? ""} /></label>
                  <label className="full">Original creator YouTube link<input name="youtubeUrl" defaultValue={selected.youtube_url ?? ""} /></label>
                  <label className="full">Your ClipToPDF/short YouTube link <span className="helper">(optional)</span><input name="clipYoutubeUrl" defaultValue={selected.clip_youtube_url ?? ""} /></label>
                  <label>Card cover crop
                    <select name="coverPosition" defaultValue={selected.cover_position ?? "center center"}>
                      {coverPositions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <span className="helper">Choose which part of the image shows on the homepage card.</span>
                  </label>
                  <label>Upload special card cover image<input type="file" name="coverImage" accept="image/png,image/jpeg,image/webp" /><span className="helper">Optional. Use this when page 1 does not have a good crop.</span></label>
                  <label>Access level
                    <select name="requiredPlan" defaultValue={selected.required_plan ?? (selected.is_pro ? "pro" : "free") }>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="premium">Premium</option>
                    </select>
                  </label>
                  <label>Free-user watermark rule
                    <select name="watermarkPolicy" defaultValue={selected.watermark_policy ?? "after_first"}>
                      <option value="after_first">Page 1 clear, rest watermarked</option>
                      <option value="all">Watermark all pages</option>
                      <option value="none">No watermark on this page set</option>
                    </select>
                    <span className="helper">This controls free accounts only. Pro/Premium do not see watermarks.</span>
                  </label>
                  <label>Description<textarea name="description" defaultValue={selected.description ?? ""} /></label>
                  <label>Replace page images<input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple /></label>
                  <label>Replace optional PDF<input type="file" name="pdfFile" accept="application/pdf" /></label>
                  <label>Replace custom free-user watermark<input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" /><span className="helper">If empty, default admin watermark is used.</span></label>
                </div>
                <div className="card-actions">
                  <button className="btn" type="submit">Save page</button>
                  <button className="btn ghost danger" type="button" onClick={deleteSelected}>Delete page</button>
                  <a className="btn ghost" href={`/pdf/${selected.id}`} target="_blank">Preview</a>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {activeTab === "upload" && (
        <form className="admin-card pop-in" onSubmit={uploadNew}>
          <span className="badge">Admin upload</span>
          <h2>Create a new visual PDF entry</h2>
          <div className="form-grid">
            <label className="full">Original creator YouTube link<input name="youtubeUrl" placeholder="Original video link from the creator" required /></label>
            <label className="full">Your ClipToPDF/short YouTube link <span className="helper">(optional — add later if needed)</span><input name="clipYoutubeUrl" placeholder="Your video link that promotes this PDF" /></label>
            <label>Title<input name="title" placeholder="Eggs with Tomato and Cheese" required /></label>
            <label>Category<select name="category" defaultValue="recipe">{categoryOptions().map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
            <label>Creator name<input name="creatorName" placeholder="Example: @BayashiTV" /></label>
            <label>Card cover crop
              <select name="coverPosition" defaultValue="center center">
                {coverPositions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <span className="helper">Controls which area appears in library cards.</span>
            </label>
            <label>Special card cover image<input type="file" name="coverImage" accept="image/png,image/jpeg,image/webp" /><span className="helper">Optional image used only for cards/search results.</span></label>
            <label>Access level<select name="requiredPlan" defaultValue="free"><option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option></select></label>
            <label>Free-user watermark rule<select name="watermarkPolicy" defaultValue="after_first"><option value="after_first">Page 1 clear, rest watermarked</option><option value="all">Watermark all pages</option><option value="none">No watermark on this page set</option></select></label>
            <label>Optional PDF file<input type="file" name="pdfFile" accept="application/pdf" /></label>
            <label>Custom free-user watermark image<input type="file" name="copyrightImage" accept="image/png,image/jpeg,image/webp" /><span className="helper">Optional. If empty, the default admin watermark is used.</span></label>
            <label className="full">Page images<input type="file" name="pageImages" accept="image/png,image/jpeg,image/webp" multiple required /><span className="helper">Upload the attractive page images. The first image becomes the card cover.</span></label>
            <label className="full">Description<textarea name="description" placeholder="Short description..." /></label>
          </div>
          <button className="btn" type="submit">Upload visual page</button>
        </form>
      )}

      {activeTab === "categories" && (
        <section className="admin-split pop-in">
          <form className="admin-card" onSubmit={saveCategory}>
            <span className="badge">Category manager</span>
            <h2>Add a dropdown category</h2>
            <div className="form-grid single-form-grid">
              <label>Category name<input name="label" placeholder="Example: Quran notes" required /></label>
              <label>Optional slug<input name="slug" placeholder="example: quran-notes" /><span className="helper">Leave empty and the site creates it automatically.</span></label>
            </div>
            <button className="btn" type="submit">Add category</button>
          </form>

          <div className="panel page-list-panel">
            <h2>Current dropdown categories</h2>
            <div className="admin-page-list">
              {categories.map((category) => (
                <div className="admin-page-row" key={category.id}>
                  <span><strong>{category.label}</strong><small>{category.slug}</small></span>
                  <button className="btn ghost danger" type="button" onClick={() => deleteCategory(category.id)}>Remove</button>
                </div>
              ))}
            </div>
            <p className="helper">Removing a category hides it from future dropdowns. Existing pages will keep the old category text until you edit them.</p>
          </div>
        </section>
      )}

      {activeTab === "users" && (
        <section className="panel pop-in">
          <h2>Latest users</h2>
          <div className="user-table">
            {users.map((user) => (
              <div className="user-row" key={user.id}>
                {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <span className="avatar-fallback small-avatar">U</span>}
                <strong>{user.display_name || user.email || "User"}</strong>
                <span>{user.email}</span>
                <span className={user.plan === "premium" ? "tag premium" : user.plan === "pro" || user.plan === "admin" ? "tag pro" : "tag"}>{user.plan}</span>
                <span>{user.subscription_status || "—"}</span>
              </div>
            ))}
          </div>
          <p className="helper">For now, manual plan changes are still done in Supabase SQL. Stripe will update plans automatically after checkout/webhook is configured.</p>
        </section>
      )}
    </main>
  );
}
