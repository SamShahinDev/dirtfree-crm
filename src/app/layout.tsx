import type { Metadata } from "next";
import "./globals.css";
import { inter, dmSans } from "./fonts";
import { ThemeProvider } from "@/providers/theme";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export const metadata: Metadata = {
  title: "Dirt Free CRM",
  description: "A modern CRM system for carpet cleaning businesses",
  // Manifest and icons temporarily disabled for performance
  // manifest: "/manifest.json",
  // appleWebApp: {
  //   capable: true,
  //   statusBarStyle: "default",
  //   title: "Dirt Free CRM",
  // },
  formatDetection: {
    telephone: false,
  },
  // icons: {
  //   icon: "/icons/icon-192x192.png",
  //   apple: "/icons/icon-192x192.png",
  // },
};

export const viewport = {
  themeColor: "#3060A0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${dmSans.variable}`}>
      <head>
        {/* CSP temporarily disabled for map testing */}
        {/* <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net; worker-src 'self' blob:; child-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.cartocdn.com https://demotiles.maplibre.org https://tile.openstreetmap.org"
        /> */}

        {/* PWA meta tags temporarily disabled for performance */}
        {/* <link rel="manifest" href="/manifest.json" /> */}
        {/* <meta name="apple-mobile-web-app-capable" content="yes" /> */}
        {/* <meta name="apple-mobile-web-app-status-bar-style" content="default" /> */}
        {/* <meta name="apple-mobile-web-app-title" content="Dirt Free CRM" /> */}
        {/* <meta name="mobile-web-app-capable" content="yes" /> */}
        {/* <meta name="msapplication-TileColor" content="#3060A0" /> */}
        {/* <meta name="msapplication-tap-highlight" content="no" /> */}
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <InstallPrompt />
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}