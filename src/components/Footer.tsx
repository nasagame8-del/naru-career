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
            <Link href="/diagnosis" className="hover:text-primary transition-colors">
              適職診断
            </Link>
            <Link href="/agent-diagnosis" className="hover:text-primary transition-colors">
              エージェント相性診断
            </Link>
            <Link href="/glossary" className="hover:text-primary transition-colors">
              用語集
            </Link>
            <Link href="/about" className="hover:text-primary transition-colors">
              著者について
            </Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">
              プライバシーポリシー
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 mt-8">
          <a href="https://x.com/AIAlto2026" target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-ink transition-colors" aria-label="X (Twitter)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          </a>
          <a href="https://note.com/altogenerative20" target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-ink transition-colors" aria-label="note">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M0 .279c4.623 0 10.953-.235 15.498-.117 6.099.156 8.39 2.813 8.468 9.374.077 3.71 0 14.335 0 14.335h-6.598c0-9.296.04-10.83 0-13.759-.078-2.578-.814-3.807-2.795-4.041-2.097-.235-7.975-.04-7.975-.04v17.84H0Z" /></svg>
          </a>
        </div>
        <p className="text-xs text-ink-soft mt-4">
          ※ 当サイトは一部アフィリエイト広告を利用しています。
        </p>
        <p className="text-xs text-ink-soft mt-2">
          &copy; {new Date().getFullYear()} NARU
        </p>
      </div>
    </footer>
  );
}
