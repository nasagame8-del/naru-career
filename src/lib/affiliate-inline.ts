import type { CTAEntry } from "./articles";
import { approvedCreativeHtml, isSafeEditorialLink } from "./approved-affiliate-creative";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function validURL(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const comparisonOptions = [
  {
    key: "mynavi_job20s",
    audience: "20代・第二新卒・既卒で転職したい",
    reason: "幅広い職種を検討したい20代向け",
    check: "自分の年齢・希望職種が対象か",
    action: "20代向けの対象条件を確認",
  },
  {
    key: "uzuz_28",
    audience: "2028年卒の就職活動を進めたい",
    reason: "卒業年度に合った支援を探したい人向け",
    check: "卒業年度・応募区分が対象か",
    action: "28卒向けの支援内容を確認",
  },
  {
    key: "techclips",
    audience: "ITエンジニアとして転職したい",
    reason: "エンジニア専門サービスを検討する人向け",
    check: "求められる実務経験・スキル",
    action: "エンジニア向けの対象条件を確認",
  },
] as const;

/** Comparison for the three in-body partner links of agent-comparison-2026. */
export function renderAgentCTAComparison(registry: Record<string, CTAEntry>, slug: string): string {
  const cards = comparisonOptions.flatMap((option) => {
    const entry = registry[option.key];
    if (!entry || !validURL(entry.url)) return [];
    const originalCreative = approvedCreativeHtml(option.key, entry);
    const safeLink = isSafeEditorialLink(entry);
    const rel = "noopener noreferrer";
    const pr = originalCreative ? '<span class="affiliate-choice__pr">広告・PR</span>' : "";
    return [
      '<article class="affiliate-choice__card" data-cta-impression="true" data-cta-key="' + escapeAttribute(option.key) + '" data-cta-id="' + escapeAttribute(option.key) + '" data-cta-placement="article_inline_comparison" data-cta-slug="' + escapeAttribute(slug) + '">' +
      '<div class="affiliate-choice__info">' +
      '<p class="affiliate-choice__audience">' + escapeHtml(option.audience) + '</p>' +
      '<h4 class="affiliate-choice__card-title">' + escapeHtml(entry.name) + '</h4>' +
      '<p class="affiliate-choice__reason">' + escapeHtml(option.reason) + '</p>' +
      '<p class="affiliate-choice__check"><strong>確認ポイント</strong> ' + escapeHtml(option.check) + '</p>' +
      '</div>' +
      '<div class="affiliate-choice__actions">' +
      '<a class="affiliate-choice__button" href="' + escapeAttribute(entry.url) + '" target="_blank" rel="' + rel +
      '" data-track-event="contextual_cta_click" data-track-key="' + escapeAttribute(option.key) +
      '" data-track-slug="' + escapeAttribute(slug) +
      '" data-track-placement="article_inline_comparison">' + escapeHtml(option.action) + ' <span aria-hidden="true">↗</span></a>' +
      pr +
      '</div>' +
      '</article>'
    ];
  });

  if (!cards.length) return "";
  return [
    '<section class="affiliate-choice" aria-label="第二新卒向け転職支援サービスの選び分け" data-cta-slug="' + escapeAttribute(slug) + '">',
    '<div class="affiliate-choice__header">',
    '<p class="affiliate-choice__eyebrow">CAREER GUIDE / 3社の選び分け</p>',
    '<h3 class="affiliate-choice__title">何を重視するかで、選ぶサービスは変わる</h3>',
    '<p class="affiliate-choice__intro">20代向け・卒業年度別・エンジニア専門では支援対象が異なります。順位ではなく、自分の条件に合うかで比較してください。</p>',
    '</div>',
    '<div class="affiliate-choice__cards">',
    ...cards,
    '</div>',
    '<p class="affiliate-choice__footnote">実際の利用条件や受付状況は各サービスの案内でご確認ください。筆者が未利用のサービスは、公開情報に基づき紹介しています。</p>',
    '</section>'
  ].join("\n");
}

/** Replace legacy [CTA_BUTTON:key] with a recognizable, measurable in-body action. */
export function renderInlineAffiliateCTA(entry: CTAEntry, key: string, slug: string): string {
  if (!validURL(entry.url)) return "";
  const action = entry.cta_text.trim() === "詳細を見る"
    ? entry.name + "の対象条件を確認する"
    : entry.cta_text;
  const rel = entry.affiliate === false ? "noopener noreferrer" : "noopener noreferrer nofollow sponsored";
  const pr = entry.affiliate === false ? "" : '<span class="affiliate-choice__pr">広告・PR</span>';
  return [
    '<aside class="affiliate-inline-cta" aria-label="' + escapeAttribute(entry.name) + 'のご案内" data-cta-impression="true" data-cta-placement="article_inline" data-cta-key="' + escapeAttribute(key) + '" data-cta-id="' + escapeAttribute(key) + '" data-cta-slug="' + escapeAttribute(slug) + '">',
    '<div class="affiliate-inline-cta__info">',
    '<span class="affiliate-inline-cta__eyebrow">サービスを確認する</span>',
    '<strong class="affiliate-inline-cta__name">' + escapeHtml(entry.name) + '</strong>',
    '<span class="affiliate-inline-cta__desc">利用対象・支援内容・申込条件を事前に確認してください。</span>',
    '</div>',
    '<div class="affiliate-inline-cta__actions">',
    '<a class="affiliate-choice__button" href="' + escapeAttribute(entry.url) + '" target="_blank" rel="' + rel +
    '" data-track-event="contextual_cta_click" data-track-key="' + escapeAttribute(key) +
    '" data-track-slug="' + escapeAttribute(slug) +
    '" data-track-placement="article_inline">' + escapeHtml(action) + ' <span aria-hidden="true">↗</span></a>',
    pr,
    '</div>',
    '</aside>'
  ].join("\n");
}
