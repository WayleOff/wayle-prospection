import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Prospection · Wayle", template: "%s · Wayle Prospection" },
  description: "Outil de prospection de Wayle Production",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#cf3f17", width: "device-width", initialScale: 1 };

// Applique le thème enregistré avant l'affichage, pour éviter un flash clair → sombre.
const THEME_INIT = `try{var t=localStorage.getItem('wayle-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT }} /></head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
