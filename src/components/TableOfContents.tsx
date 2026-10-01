import type { Heading } from "@/lib/articles";

/** モバイル用の折りたたみ目次（PCではサイドバーの目次を使う） */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  if (headings.length === 0) return null;

  return (
    <nav aria-label="目次" className="lg:hidden mb-10">
      <details className="group bg-bg-soft border border-line rounded-lg p-5">
        <summary className="font-bold text-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
          <span>目次</span>
          <span className="text-ink-soft text-xs font-normal">
            <span className="group-open:hidden">タップで開く</span>
            <span className="hidden group-open:inline">閉じる</span>
          </span>
        </summary>
        <ol className="space-y-1.5 mt-3">
          {headings.map((h, i) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className="text-sm text-ink-soft hover:text-primary transition-colors leading-relaxed flex gap-2"
              >
                <span className="font-mono text-xs text-ink-soft mt-0.5 shrink-0">
                  {i + 1}.
                </span>
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
