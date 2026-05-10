import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AppUserProfile, RequiredPlan, UserPlan } from "@/lib/types";

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

export function planRank(plan?: string | null) {
  if (plan === "admin") return 99;
  if (plan === "premium") return 3;
  if (plan === "pro") return 2;
  return 1;
}

export function requiredPlanRank(required?: string | null) {
  if (required === "premium") return 3;
  if (required === "pro") return 2;
  return 1;
}

export function isPaidPlan(plan?: string | null) {
  return plan === "pro" || plan === "premium" || plan === "admin";
}

export function canAccessRequiredPlan(userPlan?: string | null, requiredPlan?: RequiredPlan | string | null) {
  return planRank(userPlan) >= requiredPlanRank(requiredPlan);
}

export function isAdminPassword(request: Request, passwordFromBody?: string | null) {
  const headerPassword = request.headers.get("x-admin-password") ?? "";
  const password = passwordFromBody ?? headerPassword;
  return Boolean(process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD);
}
