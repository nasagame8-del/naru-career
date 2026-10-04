import Link from "next/link";
import Image from "next/image";

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M0 .279c4.623 0 10.953-.235 15.498-.117 6.099.156 8.39 2.813 8.468 9.374.077 3.71 0 14.335 0 14.335h-6.598c0-9.296.04-10.83 0-13.759-.078-2.578-.814-3.807-2.795-4.041-2.097-.235-7.975-.04-7.975-.04v17.84H0Z" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="bg-surface border-b border-line">
      <div className="site-container relative flex h-20 items-center justify-center">
        <Link href="/" className="inline-flex min-h-11 items-center">
          <Image src="/logo-wordmark.png" alt="NARU" width={172} height={44} priority className="w-[144px] md:w-[172px] h-auto" />
        </Link>
        <div className="absolute right-5 hidden sm:flex items-center text-ink-soft">
          <a href="https://x.com/AIAlto2026" target="_blank" rel="noopener noreferrer" className="flex size-11 items-center justify-center hover:text-primary" aria-label="X (Twitter)"><XIcon /></a>
          <a href="https://note.com/altogenerative20" target="_blank" rel="noopener noreferrer" className="flex size-11 items-center justify-center hover:text-primary" aria-label="note"><NoteIcon /></a>
        </div>
      </div>
      <nav aria-label="サイト" className="site-container overflow-x-auto scrollbar-hide">
        <div className="flex w-max min-w-full items-center justify-center gap-5 md:gap-8 pb-2 text-xs md:text-sm font-bold">
          <Link href="/#articles" className="header-link">記事一覧</Link>
          <Link href="/guides/second-new-grad-complete-guide" className="header-link">転職完全ガイド</Link>
          <Link href="/about" className="header-link">著者について</Link>
          <Link href="/agent-diagnosis" className="header-link">エージェント相性診断</Link>
          <Link href="/shindan" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-white hover:bg-primary/90">RPG適職診断 <span aria-hidden="true" className="ml-3">→</span></Link>
        </div>
      </nav>
    </header>
  );
}
