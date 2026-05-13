"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type NavUser = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

export default function AuthNav() {
  const [user, setUser] = useState<NavUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const authUser = data.user;
      if (!authUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }

      const metadata = authUser.user_metadata ?? {};
      setUser({
        email: authUser.email ?? "",
        name: String(metadata.full_name ?? metadata.name ?? authUser.email ?? "Account"),
        avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null
      });
      setAuthReady(true);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      listener.subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setOpen(false);
    window.location.href = "/";
  }

  return (
    <nav>
      <a href="/">Home</a>
      <a href="/pricing">Pricing</a>
      {!authReady ? (
        <span className="nav-loading-chip" aria-label="Checking account">Account...</span>
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
