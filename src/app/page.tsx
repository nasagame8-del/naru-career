import type { Metadata } from "next";
import Link from "next/link";
import { getAllArticleMetas } from "@/lib/articles";
import { CategoryTabs } from "@/components/CategoryTabs";
import { LatestNotePosts } from "@/components/LatestNotePosts";
import { HeroSection } from "@/components/HeroSection";
import { EditorialSidebar } from "@/components/EditorialSidebar";
import { WebSiteJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const articles = getAllArticleMetas();
  return (
    <>
      <WebSiteJsonLd />
      <HeroSection />
      <div className="site-container editorial-layout pb-16">
        <section id="articles" className="min-w-0 scroll-mt-6">
          <h2 className="sr-only">新着記事</h2>
          <CategoryTabs articles={articles} />
          <div className="mt-5 text-center"><Link href="/articles" className="inline-flex min-h-11 items-center text-sm text-primary">すべての記事を探す →</Link></div>
        </section>
        <EditorialSidebar />
      </div>
      <section className="border-t border-line bg-bg-soft">
        <div className="site-container py-8 flex flex-wrap items-center justify-center">
          <div className="flex flex-col items-center px-6 py-1">
            <span className="font-mono text-xl font-medium text-ink">24</span>
            <span className="text-[11px] text-ink-soft mt-0.5">歳で転職</span>
          </div>
          <div className="flex flex-col items-center px-6 py-1 border-l border-line">
            <span className="font-mono text-xl font-medium text-ink">1</span>
            <span className="text-[11px] text-ink-soft mt-0.5">回の転職経験</span>
          </div>
          <div className="flex flex-col items-center px-6 py-1 border-l border-line">
            <span className="font-mono text-xl font-medium text-ink">2</span>
            <span className="text-[11px] text-ink-soft mt-0.5">社のサービス利用</span>
          </div>
          <div className="flex flex-col items-center px-6 py-1 border-l border-line">
            <span className="text-sm font-medium text-ink">AIO対策</span>
            <span className="text-[11px] text-ink-soft mt-0.5">企業に勤務</span>
          </div>
        </div>
      </section>

      <LatestNotePosts />
    </>
  );
}
