import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AGS One",
  description: "Earn points. Redeem rewards. Have fun at work.",
  // Next serves the manifest from app/manifest.ts, but only links it when the
  // metadata object opts in.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // iOS reads these rather than the manifest. Without `capable`, an
    // added-to-home-screen AGS One opens inside Safari chrome instead of
    // standalone — and standalone is precisely what unlocks Web Push on
    // iOS 16.4+.
    capable: true,
    title: "AGS One",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Paints the browser and OS chrome to match the app shell.
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
