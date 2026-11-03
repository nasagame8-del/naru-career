import Link from "next/link";
import type { CTAEntry, ArticleCategory } from "@/lib/articles";

type Props = {
  category: ArticleCategory;
  keyword: string;
  ctaAgents: string[];
  registry: Record<string, CTAEntry>;
  slug: string;
};

const ARTICLE_PARTNER_KEYS: Record<string, string[]> = {
  "second-new-grad-web-marketing-career": ["uzuz_general"],
  "second-new-grad-web-director-career": ["uzuz_general"],
  "second-new-grad-it-company-research": ["uzuz_general"],
};

export function resolveContextualCTAKeys(slug: string, configured: string[]): string[] {
  return [...new Set([...configured, ...(ARTICLE_PARTNER_KEYS[slug] ?? [])])];
}

const PROFILE: Record<string, { audience: string; reason: string; check: string }> = {
  uzuz_general: {
    audience: "第二新卒・既卒など、若手の転職相談を検討している人",
    reason: "若手向け就職支援の対象者・相談内容を確認したい場合に",
    check: "希望職種の求人や支援範囲があるか",
  },
  mynavi_job20s: {
    audience: "20代・第二新卒・既卒で転職を検討する人",
    reason: "20代向けサービスの対象条件を確認したい場合に",
    check: "希望条件・職種への対応状況",
  },
  techclips: {
    audience: "ITエンジニアとしての転職を考えている人",
    reason: "エンジニア専門の支援を比較したい場合に",
    check: "現在の経験・スキルが対象か",
  },
  retirement_jobs: {
    audience: "退職代行の利用を検討している人",
    reason: "退職連絡などの対応範囲を確認したい場合に",
    check: "料金・運営主体・交渉可否・申込条件",
  },
  samurai_job: {
    audience: "ハイクラス転職を検討している人",
    reason: "対象となる経験・職種か確認したい場合に",
    check: "対象年収・職種・登録条件",
  },
};

function validUrl(value: string): boolean {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function ContextualAffiliateCTA({ category, keyword, ctaAgents, registry, slug }: Props) {
  const services = resolveContextualCTAKeys(slug, ctaAgents)
    .map((key) => ({ key, entry: registry[key] }))
    .filter(({ entry }) => entry && entry.affiliate === false && validUrl(entry.url))
    .slice(0, 2);
  if (services.length === 0) {
    if (slug === "agent-comparison-2026") return null;
    return (
      <section aria-label="転職サービスの比較" className="mt-12 rounded-xl border border-[#D6E1DC] bg-[#FBF8F3] p-5">
        <h2 className="mb-2 text-lg font-bold text-[#173F39]">相談先を決める前に、支援対象を比較する</h2>
        <p className="mb-3 text-sm text-[#4C6059]">希望職種や支援内容が自分に合うか、比較してから判断できます。</p>
        <Link href="/articles/agent-comparison-2026"
          data-track-event="contextual_cta_internal_click" data-track-slug={slug}
          data-track-placement="article_end" className="inline-block rounded-lg border border-[#1F6F66] px-4 py-3 font-bold text-[#1F6F66]">
          転職エージェントの比較を読む
        </Link>
      </section>
    );
  }

  const topic = /業務委託|偽装請負|フリーランス|契約/.test(keyword)
    ? "働き方を見直したいとき、次の一手は？"
    : category === "エージェント比較"
      ? "転職支援を選ぶなら、何を比べる？"
      : "自分に合う次の行動を選ぶ";

  const comparison = services.length > 1;
  return (
    <section aria-label="転職サービスと次の行動の比較" className="mt-12 overflow-hidden rounded-2xl border border-[#D6E1DC] bg-[#FBF8F3]">
      <div className="h-1.5 bg-[#1F6F66]" aria-hidden="true" />
      <div className="p-5 sm:p-7">
        <p className="mb-2 text-[11px] font-bold tracking-widest text-[#1F6F66]">NEXT STEP  |  選び方ガイド</p>
        <h2 className="mb-2 text-xl font-extrabold leading-snug text-[#173F39] sm:text-2xl">{topic}</h2>
        <p className="mb-5 text-sm leading-7 text-[#4C6059]">
          {comparison
            ? "サービスごとに対象者と確認事項が異なります。自分の状況に近いものを選んでください。"
            : "転職支援を使うか、まず情報を比較するか。状況に合わせて選べます。"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch">
          {services.map(({ key, entry }, index) => {
            const profile = PROFILE[key];
            return (
              <div key={key} data-cta-impression="true" data-cta-key={key} data-cta-id={key} data-cta-slug={slug} data-cta-placement="article_end" className="flex flex-col rounded-xl border border-[#BFD4CB] bg-white shadow-[0_3px_14px_rgba(19,61,52,0.05)]">
                <div className="flex items-center justify-between gap-2 border-b border-[#E6EDE8] px-4 py-3">
                  <span className="rounded-sm bg-[#EAF3EE] px-2 py-1 text-[11px] font-bold text-[#1F6F66]">
                    {comparison ? `選択肢 ${index + 1}` : "相談して進めたい人"}
                  </span>
                  {entry.affiliate !== false && <span className="text-[11px] font-semibold text-[#5A6A63]">広告・PR</span>}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="mb-3 text-lg font-extrabold text-[#173F39]">{entry.name}</h3>
                  <dl className="mb-5 space-y-3 text-[13px] leading-6">
                    <div>
                      <dt className="mb-0.5 font-bold text-[#1F6F66]">こんな人向け</dt>
                      <dd className="text-[#283D35]">{profile?.audience ?? "サービスの対象条件に当てはまる人"}</dd>
                    </div>
                    <div>
                      <dt className="mb-0.5 font-bold text-[#1F6F66]">選ぶ理由</dt>
                      <dd className="text-[#283D35]">{profile?.reason ?? "公式情報でサポート内容を確認したい場合に"}</dd>
                    </div>
                    <div>
                      <dt className="mb-0.5 font-bold text-[#1F6F66]">確認しておくこと</dt>
                      <dd className="text-[#5A665F]">{profile?.check ?? "利用対象・支援内容・申込条件"}</dd>
                    </div>
                  </dl>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel={entry.affiliate === false ? "noopener noreferrer" : "noopener noreferrer nofollow sponsored"}
                    data-track-event="contextual_cta_click"
                    data-track-key={key}
                    data-track-slug={slug}
                    data-track-placement="article_end"
                    className="mt-auto flex min-h-12 items-center justify-center rounded-lg bg-[#1F6F66] px-3 py-3 text-center text-[13px] font-bold leading-5 text-white transition-colors hover:bg-[#14574D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B5691B]"
                  >
                    {entry.cta_text} <span aria-hidden="true" className="ml-1.5">↗</span>
                  </a>
                </div>
              </div>
            );
          })}
          {!comparison && (
            <div className="flex flex-col rounded-xl border border-[#D6DDD8] bg-[#F2F3EF]">
              <div className="border-b border-[#D6DDD8] px-4 py-3">
                <span className="rounded-sm bg-white px-2 py-1 text-[11px] font-bold text-[#485A52]">まず比較したい人</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="mb-3 text-lg font-extrabold text-[#173F39]">転職エージェント比較</h3>
                <dl className="mb-5 space-y-3 text-[13px] leading-6">
                  <div><dt className="mb-0.5 font-bold text-[#1F6F66]">こんな人向け</dt><dd>まだ相談先を決めていない人</dd></div>
                  <div><dt className="mb-0.5 font-bold text-[#1F6F66]">選ぶ理由</dt><dd>他社との違いを確認してから決められる</dd></div>
                  <div><dt className="mb-0.5 font-bold text-[#1F6F66]">確認しておくこと</dt><dd>対象者・サポート範囲・自分との相性</dd></div>
                </dl>
                <Link
                  href="/articles/agent-comparison-2026"
                  data-track-event="contextual_cta_internal_click"
                  data-track-slug={slug}
                  data-track-placement="article_end"
                  className="mt-auto flex min-h-12 items-center justify-center rounded-lg border-2 border-[#1F6F66] bg-white px-3 py-3 text-center text-[13px] font-bold text-[#1F6F66] transition-colors hover:bg-[#EAF3EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B5691B]"
                >
                  比較記事を読んで判断する →
                </Link>
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-[#596B63]">
          掲載先の適合性は状況によって異なります。広告の有無だけで推奨順位を決めていません。
        </p>
      </div>
    </section>
  );
}
