import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mat-flow.net";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MatFlow — Gym Management & Scheduling for BJJ Academies",
    template: "%s | MatFlow",
  },
  description:
    "MatFlow is gym management built for BJJ academies. Class scheduling, student sign-ups, Stripe payments, and a live embeddable schedule — in one platform.",
  keywords: [
    "BJJ gym management",
    "jiu-jitsu class scheduling",
    "martial arts gym software",
    "gym class booking app",
    "MMA gym scheduling",
    "embeddable class schedule",
    "gym membership software",
    "Brazilian jiu-jitsu academy",
  ],
  authors: [{ name: "MatFlow", url: SITE_URL }],
  creator: "MatFlow",
  publisher: "MatFlow",
  icons: {
    icon: "/icon.png",
    apple: "/logo-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "MatFlow",
    title: "MatFlow — Gym Management & Scheduling for BJJ Academies",
    description:
      "Beautiful embeddable schedules, student self check-ins, and clean Stripe billing for BJJ gyms.",
    images: [
      {
        url: "/og-image.png",           // ← Changed to static image
        width: 1200,
        height: 630,
        alt: "MatFlow — Gym Management Platform for BJJ Academies",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MatFlow — Gym Management & Scheduling for BJJ Academies",
    description:
      "Beautiful embeddable schedules, student self check-ins, and clean Stripe billing for BJJ gyms.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster richColors closeButton position="bottom-right" />
      </body>
    </html>
  );
}