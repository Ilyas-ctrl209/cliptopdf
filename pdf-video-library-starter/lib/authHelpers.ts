import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AppUserProfile, UserPlan } from "@/lib/types";

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

export async function requireUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "Login required." }, { status: 401 }) };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { error: NextResponse.json({ error: "Invalid login session." }, { status: 401 }) };
  }

  return { user: data.user };
}

export async function ensureUserProfile(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  const displayName = String(metadata.full_name ?? metadata.name ?? user.email ?? "Reader");
  const avatarUrl = String(metadata.avatar_url ?? "") || null;

  const { data: existing } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return existing as AppUserProfile;

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .insert({
      user_id: user.id,
      email: user.email ?? null,
      display_name: displayName,
      avatar_url: avatarUrl,
      plan: "free" satisfies UserPlan
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as AppUserProfile;
}

export function isPaidPlan(plan?: string | null) {
  return plan === "pro" || plan === "admin";
}
