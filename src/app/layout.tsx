import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://treemap.app";

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#22c55e",
};

export const metadata: Metadata = {
  title: "TreeMap — Boston Tree Service Lead Intelligence",
  description:
    "Real-time map of storm-damaged and tree-stressed properties across Greater Boston. Generate priority direct mail lists in one click.",
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TreeMap" },
  other: { "color-scheme": "dark" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
