import type { Metadata } from "next";
import AuthNav from "@/app/components/AuthNav";
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
          <AuthNav />
        </header>
        {children}
      </body>
    </html>
  );
}
