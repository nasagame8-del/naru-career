import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { SurveyLink } from "./SurveyLink";

export function Footer() {
  return (
    <footer className="bg-primary text-white">
      <div className="site-container py-14 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-4xl tracking-wider font-bold text-white">NARU</p>
            <p className="text-sm text-white/80 mt-1">
              第二新卒のIT転職ガイド
            </p>
          </div>
          <nav aria-label="フッター" className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm text-white/80">
            <Link href="/guides/second-new-grad-complete-guide" className="inline-flex min-h-11 items-center hover:text-white transition-colors">
              転職完全ガイド
            </Link>
            <Link href="/shindan" className="inline-flex min-h-11 items-center hover:text-white transition-colors">
              RPG適職診断
            </Link>
            <Link href="/agent-diagnosis" className="inline-flex min-h-11 items-center hover:text-white transition-colors">
              エージェント相性診断
            </Link>
            <Link href="/glossary" className="inline-flex min-h-11 items-center hover:text-white transition-colors">
              用語集
            </Link>
            <Link href="/about" className="inline-flex min-h-11 items-center hover:text-white transition-colors">
              著者について
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-white transition-colors">
              プライバシーポリシー
            </Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center hover:text-white transition-colors">
              お問い合わせ
            </Link>
            <SurveyLink className="inline-flex min-h-11 items-center hover:text-white transition-colors">
              転職調査にご協力ください
            </SurveyLink>
          </nav>
        </div>
        <nav aria-label="フッターカテゴリ" className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/20 pt-6 text-sm text-white/80">
          {Object.entries(CATEGORIES).map(([slug, cat]) => <Link key={slug} href={`/category/${slug}`} className="inline-flex min-h-11 items-center hover:text-white">{cat.label}</Link>)}
          <Link href="/articles" className="inline-flex min-h-11 items-center hover:text-white">記事一覧</Link>
        </nav>
        <div className="flex items-center gap-4 mt-8">
          <a href="https://x.com/AIAlto2026" target="_blank" rel="noopener noreferrer" className="flex size-11 items-center justify-center text-white/80 hover:text-white transition-colors" aria-label="X (Twitter)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          </a>
          <a href="https://note.com/altogenerative20" target="_blank" rel="noopener noreferrer" className="flex size-11 items-center justify-center text-white/80 hover:text-white transition-colors" aria-label="note">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 .279c4.623 0 10.953-.235 15.498-.117 6.099.156 8.39 2.813 8.468 9.374.077 3.71 0 14.335 0 14.335h-6.598c0-9.296.04-10.83 0-13.759-.078-2.578-.814-3.807-2.795-4.041-2.097-.235-7.975-.04-7.975-.04v17.84H0Z" /></svg>
          </a>
        </div>
        <p className="text-xs text-white/80 mt-4">
          ※ 当サイトは一部アフィリエイト広告を利用しています。
        </p>
        <p className="text-xs text-white/80 mt-2">
          &copy; {new Date().getFullYear()} NARU
        </p>
      </div>
    </footer>
  );
}
