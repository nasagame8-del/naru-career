import { getValueCommerceDocument, VALUECOMMERCE_TEXT_CODES } from "@/lib/valuecommerce";

export function ValueCommerceAd({ pid, width, height, name }: {
  pid: string; width: number; height: number; name: string;
}) {
  const textCode = VALUECOMMERCE_TEXT_CODES[pid];
  return (
    <div>
      {/* Keep the supplied script and noscript intact; document.write needs its own parser. */}
      <iframe title={`広告：${name}のバナー`} srcDoc={getValueCommerceDocument(pid)}
        width={width} height={height} loading="lazy"
        style={{ display: "block", width, height, border: 0, marginLeft: `calc(50% - ${width / 2}px)` }} />
      {textCode && <p className="mt-3 text-sm leading-relaxed underline"
        dangerouslySetInnerHTML={{ __html: textCode }} />}
    </div>
  );
}
