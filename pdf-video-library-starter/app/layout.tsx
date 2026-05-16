import type { Metadata } from "next";
import AuthNav from "@/app/components/AuthNav";
import ScrollProgress from "@/app/components/ScrollProgress";
import LogoMark from "@/app/components/LogoMark";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipToPDF Library",
  description: "Paste a YouTube link and open the beautiful visual PDF version."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ScrollProgress />
        <header className="site-header">
          <a href="/" className="brand" aria-label="ClipToPDF home">
            <LogoMark />
            <span>ClipToPDF</span>
          </a>
          <AuthNav />
        </header>
        {children}
      </body>
    </html>
  );
}
