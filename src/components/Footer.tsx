import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-bg-soft border-t border-line">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <div>
            <p className="font-bold text-ink">NARU</p>
            <p className="text-sm text-ink-soft mt-1">
              第二新卒のIT転職ガイド
            </p>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-ink-soft">
            <Link href="/glossary" className="hover:text-accent transition-colors">
              用語集
            </Link>
            <Link href="/about" className="hover:text-accent transition-colors">
              著者について
            </Link>
            <Link href="/privacy" className="hover:text-accent transition-colors">
              プライバシーポリシー
            </Link>
          </nav>
        </div>
        <p className="text-xs text-ink-soft mt-8">
          ※ 当サイトは一部アフィリエイト広告を利用しています。
        </p>
        <p className="text-xs text-ink-soft mt-2">
          &copy; {new Date().getFullYear()} NARU
        </p>
      </div>
    </footer>
  );
}
