/**
 * @file frontend/src/app/layout.tsx
 * @description فایل اصلی لایوت ریشه ERP Pro
 */

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Vazirmatn } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PreferencesProvider } from "@/components/preferences-provider";
import { VisitorPresenceTracker } from "@/components/home/visitor-presence-tracker";
import { OrganizationFavicon } from "@/components/organization-favicon";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: true,
});

const appearanceBootstrap = `(() => {
  try {
    const root = document.documentElement;
    const theme = localStorage.getItem('erp-theme') || 'system';
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.remove('light', 'dark');
    root.classList.add(dark ? 'dark' : 'light');
    root.dataset.theme = theme;
    root.style.colorScheme = dark ? 'dark' : 'light';

    const defaults = dark ? {
      '--primary': '#3b82f6', '--background': '#171819', '--surface': '#222426',
      '--surface-elevated': '#282a2c', '--surface-muted': '#2a3038', '--surface-hover': '#333a43',
      '--card': '#222426', '--card-foreground': '#a8afb7', '--foreground': '#a8afb7',
      '--muted-foreground': '#929aa4', '--border': '#353c45', '--border-strong': '#48515c', '--input': '#3a424d',
    } : {
      '--primary': '#60a5fa', '--background': '#f1f1f1', '--surface': '#fafafa',
      '--surface-elevated': '#ffffff', '--surface-muted': '#eceff3', '--surface-hover': '#e6eaf0',
      '--card': '#fafafa', '--card-foreground': '#3f4b5c', '--foreground': '#3f4b5c',
      '--muted-foreground': '#687486', '--border': '#dce1e8', '--border-strong': '#cbd2dc', '--input': '#d6dde7',
    };
    for (const [property, value] of Object.entries(defaults)) root.style.setProperty(property, value);

    const cached = JSON.parse(localStorage.getItem('erp-public-branding-v1') || 'null');
    const appearance = dark ? cached?.darkStyles : cached?.lightStyles;
    if (cached?.savedAt && Date.now() - cached.savedAt < 5 * 60 * 1000 && appearance && typeof appearance === 'object') {
      for (const [property, value] of Object.entries(appearance)) {
        if (typeof value === 'string') root.style.setProperty(property, value);
      }
    }
  } catch {}
})();`;

export const metadata: Metadata = {
  title: {
    default: "Rahyar",
    template: "%s | Rahyar",
  },
  description: "پلتفرم یکپارچه ERP و CRM",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={vazirmatn.variable}
    >
      <body className="font-sans antialiased h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
        <Script id="appearance-bootstrap" strategy="beforeInteractive">{appearanceBootstrap}</Script>
        <ThemeProvider>
          <PreferencesProvider><VisitorPresenceTracker /><OrganizationFavicon />{children}</PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
