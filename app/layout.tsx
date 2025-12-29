import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bottleneckbots.com"),
  title: {
    default: "Bottleneck Bots - AI-Powered Workflow Automation",
    template: "%s | Bottleneck Bots",
  },
  description: "Automate your workflows with intelligent bots. Monitor websites, sync data, send notifications, and scrape web pages - all without writing code.",
  keywords: ["workflow automation", "bot automation", "no-code", "website monitoring", "web scraping", "notifications"],
  authors: [{ name: "Bottleneck Bots" }],
  creator: "Bottleneck Bots",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bottleneckbots.com",
    siteName: "Bottleneck Bots",
    title: "Bottleneck Bots - AI-Powered Workflow Automation",
    description: "Automate your workflows with intelligent bots.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bottleneck Bots",
    description: "Automate your workflows with intelligent bots.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
