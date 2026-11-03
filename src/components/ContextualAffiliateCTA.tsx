import Link from "next/link";
import type { CTAEntry, ArticleCategory } from "@/lib/articles";

type Props = {
  category: ArticleCategory;
  keyword: string;
  ctaAgents: string[];
  registry: Record<string, CTAEntry>;
  slug: string;
};

const validUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

/** Editorial CTA: editorially selected services only, never infer a partner from keyword alone. */
export function ContextualAffiliateCTA({ category, keyword, ctaAgents, registry, slug }: Props) {
  const services = [...new Set(ctaAgents)]
    .map((key) => ({ key, entry: registry[key] }))
    .filter(({ entry }) => entry && validUrl(entry.url))
    .slice(0, 2);
  if (services.length === 0) return null;

  const isAgency = category === "エージェント比較";
  const topic = /業務委託|偽装請負|フリーランス|契約/.test(keyword)
    ? "今の働き方を見直すときに"
    : isAgency
      ? "転職支援サービスを比較する前に"
      : "次の選択肢を考えるときに";

  return (
    <section aria-label="次の選択肢" className="mt-12 overflow-hidden rounded-xl border border-[#D8E4DF] bg-[#FBF8F3]">
      <div className="border-l-4 border-[#1F6F66] px-5 py-6 sm:px-7 sm:py-7">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#1F6F66]">NEXT STEP / 次の選択肢</p>
        <h2 className="mb-3 text-xl font-bold leading-snug text-[#193D38]">{topic}</h2>
        <p className="mb-5 text-sm leading-7 text-[#43534F]">
          サービスの対象者・相談内容・利用条件を確認し、自分の状況に合うか判断してください。
          合わない場合は無理に申し込む必要はありません。
        </p>
        <div className="grid gap-3">
          {services.map(({ key, entry }) => (
            <div key={key} className="rounded-lg border border-[#D8E4DF] bg-white px-4 py-4 sm:px-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-[#193D38]">{entry.name}</h3>
                {entry.affiliate !== false && <span className="shrink-0 rounded border border-[#BFCFC7] px-2 py-0.5 text-[10px] text-[#43534F]">広告・PR</span>}
              </div>
              <a
                href={entry.url}
                target="_blank"
                rel={entry.affiliate === false ? "noopener noreferrer" : "noopener noreferrer nofollow sponsored"}
                data-track-event="contextual_cta_click"
                data-track-key={key}
                data-track-slug={slug}
                data-track-placement="article_end"
                className="flex min-h-12 items-center justify-center rounded-md bg-[#1F6F66] px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#15564F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B5691B]"
              >
                {entry.cta_text}（{entry.name}） <span aria-hidden="true" className="ml-2">↗</span>
              </a>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-[#63736D]">
          比較してから判断したい方は <Link className="font-semibold underline underline-offset-2" href="/articles/agent-comparison-2026">転職エージェント比較記事</Link> も参考にしてください。
        </p>
      </div>
    </section>
  );
}
