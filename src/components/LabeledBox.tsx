/**
 * ラベル付き囲みボックス。
 *
 * 記事冒頭の「この記事の要点」「この記事で分かること」と、本文Markdownの
 * `:::box ラベル` が同じ見た目になるよう、CSSクラスをここで一本化する。
 * 装飾は `.naru-box` 側（globals.css）に置き、記事ごとの指定は不要。
 */
export function LabeledBox({
  label,
  variant = "default",
  className,
  children,
}: {
  label: string;
  /** quiet: 冒頭に2つ並ぶときに後ろ側を一段落ち着かせる */
  variant?: "default" | "quiet";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "naru-box",
        variant === "quiet" ? "naru-box--quiet" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="naru-box-label">{label}</p>
      {children}
    </div>
  );
}
