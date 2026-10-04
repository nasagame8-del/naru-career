import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Header } from "@/components/Header";
import { CategoryNavBar } from "@/components/CategoryNavBar";
import { Footer } from "@/components/Footer";
import { GoogleTagManager, GoogleTagManagerNoscript } from "@/components/GoogleTagManager";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
import { CtaTracker } from "@/components/CtaTracker";
import { WebSiteJsonLd } from "@/components/JsonLd";
import { CATEGORIES } from "@/lib/categories";
import { getAuthorProfileLabel } from "@/lib/author";

const categoryNavItems = Object.entries(CATEGORIES).map(([slug, cat]) => ({
  label: cat.label,
  href: `/category/${slug}`,
}));

// 著者の年齢（AUTHOR_BIRTHDATE から計算）を日付が変わったら反映するため、1日ごとに再生成する
export const revalidate = 86400;

export function generateMetadata(): Metadata {
  return {
    title: {
      default: "NARU | 第二新卒のIT転職ガイド",
      template: "%s | NARU",
    },
    description: `著者・磯貝アルトの実体験（${getAuthorProfileLabel()}）をベースに、第二新卒がIT/Web業界へキャリアチェンジするためのノウハウを発信。転職エージェント比較・業界解説・体験談を掲載。`,
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com"),
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      siteName: "NARU",
      locale: "ja_JP",
      type: "website",
      images: ["/logo-wordmark.png"],
    },
  };
}

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
        <WebSiteJsonLd />
        <Script id="google-fonts-loader" strategy="afterInteractive">
          {`
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;900&family=Noto+Serif+JP:wght@400;600;700&display=swap';
            document.head.appendChild(link);
          `}
        </Script>
        <GoogleTagManager />
        <GoogleTagManagerNoscript />
        <MicrosoftClarity />
        <CtaTracker />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:text-ink focus:px-4 focus:py-2 focus:rounded focus:border focus:border-line"
        >
          本文へスキップ
        </a>
        <Header />
        <CategoryNavBar categories={categoryNavItems} />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
