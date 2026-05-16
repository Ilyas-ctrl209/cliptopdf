"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const NAV_CACHE_KEY = "cliptopdf_nav_user";

type NavUser = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

function readCachedUser(): NavUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NAV_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NavUser>;
    if (!parsed.email && !parsed.name) return null;
    return {
      email: String(parsed.email ?? ""),
      name: String(parsed.name ?? parsed.email ?? "Account"),
      avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null
    };
  } catch {
    return null;
  }
}

function cacheUser(user: NavUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(NAV_CACHE_KEY);
    return;
  }
  localStorage.setItem(NAV_CACHE_KEY, JSON.stringify(user));
}

export default function AuthNav() {
  const [user, setUser] = useState<NavUser | null>(() => readCachedUser());
  const [authReady, setAuthReady] = useState(() => Boolean(readCachedUser()));
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadUser() {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const authUser = sessionData.session?.user;

      if (!token || !authUser) {
        setUser(null);
        cacheUser(null);
        setAuthReady(true);
        return;
      }

      const metadata = authUser.user_metadata ?? {};
      let nextUser: NavUser = {
        email: authUser.email ?? "",
        name: String(metadata.full_name ?? metadata.name ?? authUser.email ?? "Account"),
        avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null
      };

      try {
        const response = await fetch("/api/account/profile", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        const json = await response.json();
        if (response.ok && json.profile) {
          nextUser = {
            email: json.profile.email ?? nextUser.email,
            name: json.profile.display_name || nextUser.name,
            avatarUrl: json.profile.avatar_url || nextUser.avatarUrl
          };
        }
      } catch {
        // Keep metadata fallback if the profile route is temporarily unavailable.
      }

      setUser(nextUser);
      cacheUser(nextUser);
      setAuthReady(true);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    function handleProfileUpdated(event: Event) {
      const custom = event as CustomEvent<NavUser>;
      if (custom.detail) {
        setUser(custom.detail);
        cacheUser(custom.detail);
        setAuthReady(true);
      } else {
        loadUser();
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("cliptopdf-profile-updated", handleProfileUpdated as EventListener);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("cliptopdf-profile-updated", handleProfileUpdated as EventListener);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    cacheUser(null);
    setUser(null);
    setOpen(false);
    window.location.href = "/";
  }

  return (
    <nav>
      <a href="/">Home</a>
      <a href="/pricing">Pricing</a>
      {!authReady ? (
        <span className="nav-loading-chip" aria-label="Checking account">Account</span>
      ) : user ? (
        <div className="account-menu" ref={menuRef}>
          <button className="account-chip" onClick={() => setOpen((value) => !value)} type="button">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="Profile" className="account-avatar" />
            ) : (
              <span className="account-avatar fallback">{user.name.slice(0, 1).toUpperCase()}</span>
            )}
            <span className="account-name">{user.name.split(" ")[0]}</span>
            <span className="chev">⌄</span>
          </button>

          {open && (
            <div className="account-dropdown pop-in">
              <div className="account-dropdown-head">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="Profile" className="dropdown-avatar" />
                ) : (
                  <span className="dropdown-avatar fallback">{user.name.slice(0, 1).toUpperCase()}</span>
                )}
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <a href="/account">Account</a>
              <a href="/creator">Creator studio</a>
              <a href="/pricing">Upgrade plan</a>
              <button type="button" onClick={logout}>Logout</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <a href="/login">Login</a>
          <a className="nav-pill" href="/signup">Sign up</a>
        </>
      )}
    </nav>
  );
}
