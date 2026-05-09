import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipToPDF Library",
  description: "Paste a YouTube link and open the beautiful visual PDF version."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            <span className="brand-mark">▣</span>
            <span>ClipToPDF</span>
          </a>
          <nav>
            <a href="/">Home</a>
            <a href="/pricing">Pricing</a>
            <a href="/login">Login</a>
            <a className="nav-pill" href="/signup">Sign up</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
