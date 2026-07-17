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
      <path d="M22 5.9c0-.4-.1-.7-.2-1-.2-.5-.5-.9-1-1.2-.3-.2-.7-.3-1.1-.4-.5-.1-1-.1-1.5-.1H5.8c-.5 0-1 0-1.5.1-.4.1-.8.2-1.1.4-.5.3-.8.7-1 1.2-.1.3-.2.6-.2 1v12.2c0 .4.1.7.2 1 .2.5.5.9 1 1.2.3.2.7.3 1.1.4.5.1 1 .1 1.5.1h12.4c.5 0 1 0 1.5-.1.4-.1.8-.2 1.1-.4.5-.3.8-.7 1-1.2.1-.3.2-.6.2-1V5.9zM9.8 16.4H7.6V9.8h2.2v6.6zm4.4 0h-2.2v-4.1h2.2v4.1zm4.2 0H16V7.6h2.4v8.8z" />
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
            <Link href="/#articles" className="hover:text-accent transition-colors">
              記事一覧
            </Link>
            <Link href="/about" className="hover:text-accent transition-colors">
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
