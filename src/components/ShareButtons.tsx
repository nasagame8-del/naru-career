const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com";

function XShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function HatenaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.47 2H3.53A1.45 1.45 0 002 3.47v17.06A1.45 1.45 0 003.47 22h17.06A1.45 1.45 0 0022 20.53V3.47A1.45 1.45 0 0020.47 2zM8.8 17.5a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5zM9.13 14H7.47V6h1.66zm7.6 3.5h-4.2v-1.4h1.27V9.9h-1.27V8.5h2.93v7.6h1.27z" />
    </svg>
  );
}

export function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const articleUrl = `${baseUrl}/articles/${slug}`;
  const encodedUrl = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-ink-soft font-mono">SHARE</span>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink-soft hover:text-ink transition-colors"
        aria-label="Xでシェア"
      >
        <XShareIcon />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink-soft hover:text-ink transition-colors"
        aria-label="Facebookでシェア"
      >
        <FacebookIcon />
      </a>
      <a
        href={`https://b.hatena.ne.jp/entry/${articleUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink-soft hover:text-ink transition-colors"
        aria-label="はてなブックマーク"
      >
        <HatenaIcon />
      </a>
    </div>
  );
}
