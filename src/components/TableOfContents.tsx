import type { Heading } from "@/lib/articles";
import { MiniAlto } from "./MiniAlto";

export function TableOfContents({ headings }: { headings: Heading[] }) {
  if (headings.length === 0) return null;

  return (
    // PC（サイドバーあり）では非表示、モバイルのみ折りたたみで表示
    <details className="lg:hidden relative bg-bg-soft border border-line rounded-lg p-5 mb-10">
      <summary className="font-bold text-sm cursor-pointer list-none flex items-center justify-between">
        <span>目次</span>
        <span className="text-ink-soft text-xs">タップで開く</span>
      </summary>
      <ol className="space-y-1.5 mt-3">
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
    </details>
  );
}
