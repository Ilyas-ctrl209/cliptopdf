import { NextResponse } from "next/server";
import { ensureUserProfile, requireUser } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const required = await requireUser(request);
  if ("error" in required) return required.error;
  const profile = await ensureUserProfile(required.user);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const required = await requireUser(request);
  if ("error" in required) return required.error;

  await ensureUserProfile(required.user);
  const body = await request.json().catch(() => ({}));
  const displayName = String(body.display_name ?? "").trim();
  const bio = String(body.bio ?? "").trim();
  const avatarUrl = String(body.avatar_url ?? "").trim();

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .update({
      display_name: displayName || null,
      bio: bio || null,
      avatar_url: avatarUrl || null
    })
    .eq("user_id", required.user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep creator-facing identity in sync, so the top bar, creator studio,
  // creator cards, and older uploads reflect the changed public name.
  await supabaseAdmin.from("creator_profiles").upsert(
    {
      user_id: required.user.id,
      display_name: displayName || data.email || "Creator",
      email: data.email,
      avatar_url: avatarUrl || null,
      bio: bio || null
    },
    { onConflict: "user_id" }
  );

  if (displayName) {
    await supabaseAdmin
      .from("pdfs")
      .update({ creator_name: displayName })
      .eq("creator_user_id", required.user.id);
  }

  return NextResponse.json({ profile: data });
}
