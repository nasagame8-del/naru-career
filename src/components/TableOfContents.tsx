import type { Heading } from "@/lib/articles";

export function TableOfContents({ headings }: { headings: Heading[] }) {
  if (headings.length === 0) return null;

  return (
    <nav className="bg-bg-soft border border-line rounded-lg p-5 mb-10">
      <p className="font-bold text-sm mb-3">目次</p>
      <ol className="space-y-1.5">
        {headings.map((h, i) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className="text-sm text-ink-soft hover:text-primary transition-colors leading-relaxed flex gap-2"
            >
              <span className="font-mono text-xs text-ink-soft/60 mt-0.5 shrink-0">
                {i + 1}.
              </span>
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
