import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";

export const metadata: Metadata = {
  title: "SpareHub — Every Part. One Marketplace.",
  description:
    "The dedicated multi-vendor automotive spare parts marketplace for Sri Lanka. Genuine parts for cars, three-wheelers, motorcycles, vans, buses, and heavy machinery.",
  keywords: [
    "Spare parts Sri Lanka",
    "Auto parts Colombo",
    "Three-wheeler parts",
    "Bajaj RE spares",
    "Toyota parts Sri Lanka",
    "SpareHub",
  ],
};

export const viewport: Viewport = {
  themeColor: "#FF6B00",
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
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-white text-sparehub-dark">
        <Navbar />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
