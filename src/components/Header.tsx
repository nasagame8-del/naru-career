import Link from "next/link";
import Image from "next/image";

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 .279c4.623 0 10.953-.235 15.498-.117 6.099.156 8.39 2.813 8.468 9.374.077 3.71 0 14.335 0 14.335h-6.598c0-9.296.04-10.83 0-13.759-.078-2.578-.814-3.807-2.795-4.041-2.097-.235-7.975-.04-7.975-.04v17.84H0Z" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="border-b border-line">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo-wordmark.png"
            alt="NARU"
            width={140}
            height={36}
            priority
          />
        </Link>
        <div className="flex items-center gap-5">
          <nav className="hidden sm:flex items-center gap-6 text-sm text-ink-soft">
            <Link href="/#articles" className="hover:text-primary transition-colors">
              記事一覧
            </Link>
            <Link href="/about" className="hover:text-primary transition-colors">
              著者について
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-ink-soft">
            <a
              href="https://x.com/AIAlto2026"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors"
              aria-label="X (Twitter)"
            >
              <XIcon />
            </a>
            <a
              href="https://note.com/altogenerative20"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors"
              aria-label="note"
            >
              <NoteIcon />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
