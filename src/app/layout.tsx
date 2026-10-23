/**
 * @file frontend/src/app/layout.tsx
 * @description فایل اصلی لایوت ریشه ERP Pro
 */

import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PreferencesProvider } from "@/components/preferences-provider";
import { VisitorPresenceTracker } from "@/components/home/visitor-presence-tracker";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "ERP Pro",
    template: "%s | ERP Pro",
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
        <ThemeProvider>
          <PreferencesProvider><VisitorPresenceTracker />{children}</PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
