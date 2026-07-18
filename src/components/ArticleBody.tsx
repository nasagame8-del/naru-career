import { ComparisonTable } from "./ComparisonTable";
import { FlowDiagram } from "./FlowDiagram";
import type { ArticleWidget } from "@/lib/article-widgets";

type Props = {
  contentHtml: string;
  widgets: ArticleWidget[];
  className?: string;
  style?: React.CSSProperties;
};

const WIDGET_RE = /<div data-widget="([\w-]+)" data-widget-id="([\w-]+)"><\/div>/g;

export function ArticleBody({ contentHtml, widgets, className, style }: Props) {
  // ウィジェットが無ければ従来通り
  if (widgets.length === 0) {
    return (
      <div
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    );
  }

  // HTMLをウィジェットマーカーで分割
  const segments: (string | ArticleWidget)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(WIDGET_RE.source, "g");
  while ((match = re.exec(contentHtml)) !== null) {
    // マーカー前のHTMLチャンク
    if (match.index > lastIndex) {
      segments.push(contentHtml.slice(lastIndex, match.index));
    }
    // 対応するウィジェットを探す
    const widgetType = match[1];
    const widgetId = match[2];
    const widget = widgets.find((w) => w.type === widgetType && w.id === widgetId);
    if (widget) {
      segments.push(widget);
    }
    lastIndex = match.index + match[0].length;
  }
  // 残りのHTML
  if (lastIndex < contentHtml.length) {
    segments.push(contentHtml.slice(lastIndex));
  }

  return (
    <div className={className} style={style}>
      {segments.map((seg, i) => {
        if (typeof seg === "string") {
          return (
            <div key={i} dangerouslySetInnerHTML={{ __html: seg }} />
          );
        }
        if (seg.type === "comparison-table") {
          return <ComparisonTable key={i} {...seg.props} />;
        }
        if (seg.type === "flow-diagram") {
          return <FlowDiagram key={i} {...seg.props} />;
        }
        return null;
      })}
    </div>
  );
}
