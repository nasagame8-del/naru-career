import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Header } from "@/components/Header";
import { CategoryNavBar } from "@/components/CategoryNavBar";
import { Footer } from "@/components/Footer";
import { GoogleTagManager, GoogleTagManagerNoscript } from "@/components/GoogleTagManager";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
import { CtaTracker } from "@/components/CtaTracker";

export const metadata: Metadata = {
  title: {
    default: "NARU | 第二新卒のIT転職ガイド",
    template: "%s | NARU",
  },
  description:
    "24歳・転職1回の実体験をベースに、第二新卒がIT/Web業界へキャリアチェンジするためのノウハウを発信。転職エージェント比較・業界解説・体験談を掲載。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    siteName: "NARU",
    images: ["/logo-wordmark.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <Script id="google-fonts-loader" strategy="afterInteractive">
          {`
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Shippori+Mincho:wght@600&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap';
            document.head.appendChild(link);
          `}
        </Script>
        <GoogleTagManager />
        <GoogleTagManagerNoscript />
        <MicrosoftClarity />
        <CtaTracker />
        <Header />
        <CategoryNavBar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
