import type { SCData, QueryInsight } from "@/types/search-console";

export type GrowthArticleInput = {
  slug: string;
  title: string;
  keyword: string;
  body: string;
  outgoing: string[];
  faqCount: number;
  summaryCount: number;
  hasAuthoritativeSource: boolean;
  hasUpdateHistory: boolean;
  hasImage: boolean;
  hasComparisonTable: boolean;
};

export type ResearchSource = {
  id: string;
  label: string;
  url: string;
  category: string;
  cadence: "daily" | "weekly" | "monthly";
};

export type ResearchSourceStatus = {
  id: string;
  checkedAt?: string | null;
  httpStatus?: number | null;
  title?: string | null;
  hash?: string | null;
  changed?: boolean;
  error?: string | null;
};

export type DemandRadarItem = {
  query: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  previousPosition: number | null;
  impressionChange: number | null;
  score: number;
  signal: "top10_close" | "striking_distance" | "new_query" | "surging" | "watch";
  action: string;
  page: string | null;
};

export type SeoExperimentProposal = {
  id: string;
  query: string;
  page: string;
  slug: string;
  position: number;
  impressions: number;
  experimentType: "title_snippet" | "content_expand" | "internal_links";
  hypothesis: string;
  successMetric: string;
  checkpoints: number[];
  status: "proposal";
  score: number;
};

export type InternalLinkSuggestion = {
  sourceSlug: string;
  targetSlug: string;
  anchor: string;
  score: number;
  reason: string;
};

export type AioScore = {
  slug: string;
  title: string;
  score: number;
  grade: "A" | "B" | "C" | "D";
  checks: {
    directAnswer: boolean;
    faq: boolean;
    authoritativeSource: boolean;
    definitionStructure: boolean;
    updateHistory: boolean;
    image: boolean;
    comparison: boolean;
    datedEvidence: boolean;
  };
  missing: string[];
};

export type GrowthLabData = {
  generatedAt: string;
  demandRadar: DemandRadarItem[];
  experiments: SeoExperimentProposal[];
  internalLinks: InternalLinkSuggestion[];
  aioScores: AioScore[];
  research: {
    configuredSources: number;
    changedSources: number;
    failedSources: number;
    sources: Array<ResearchSource & { status?: ResearchSourceStatus }>;
  };
};

function slugFromPage(page: string): string {
  try {
    const pathname = new URL(page).pathname;
    return pathname.replace(/^\/articles\//, "").replace(/\/$/, "");
  } catch {
    return page.replace(/^\/articles\//, "").replace(/\/$/, "");
  }
}

function demandScore(item: QueryInsight): number {
  let score = Math.min(25, item.impressions);
  if (item.position <= 10 && item.position >= 4) score += 35;
  else if (item.position <= 20) score += 25;
  if (item.impressionChange !== null && item.impressionChange >= 50) score += 15;
  if (item.prevPosition === null) score += 12;
  if (item.position <= 10 && item.clicks === 0) score += 12;
  if (item.positionChange !== null && item.positionChange <= -3) score += 8;
  return Math.round(score);
}

function radarSignal(item: QueryInsight): DemandRadarItem["signal"] {
  if (item.prevPosition === null) return "new_query";
  if (item.position >= 4 && item.position <= 10) return "top10_close";
  if (item.position > 10 && item.position <= 20) return "striking_distance";
  if (item.impressionChange !== null && item.impressionChange >= 50) return "surging";
  return "watch";
}

function radarAction(item: QueryInsight): string {
  if (item.position <= 10 && item.clicks === 0) return "タイトル・冒頭・スニペット候補を改善";
  if (item.position <= 10) return "CTRを維持しつつ関連内部リンクを追加";
  if (item.position <= 20) return "回答精度を上げ、関連記事から内部リンクを追加";
  if (item.prevPosition === null) return "新規需要として既存記事との差分を確認";
  return "監視";
}

export function buildDemandRadar(gsc: SCData): DemandRadarItem[] {
  const items = gsc.queryInsights ?? [];
  return items
    .filter((item) => item.impressions > 0 && item.position > 0)
    .map((item) => {
      const page = item.pages?.[0]?.page ?? null;
      return {
        query: item.query,
        position: item.position,
        impressions: item.impressions,
        clicks: item.clicks,
        ctr: item.ctr,
        previousPosition: item.prevPosition,
        impressionChange: item.impressionChange,
        score: demandScore(item),
        signal: radarSignal(item),
        action: radarAction(item),
        page,
      };
    })
    .sort((a, b) => b.score - a.score || b.impressions - a.impressions)
    .slice(0, 20);
}

function experimentType(item: DemandRadarItem): SeoExperimentProposal["experimentType"] {
  if (item.position <= 10 && (item.clicks === 0 || item.ctr < 0.02)) return "title_snippet";
  if (item.position <= 15) return "content_expand";
  return "internal_links";
}

export function buildSeoExperiments(radar: DemandRadarItem[]): SeoExperimentProposal[] {
  return radar
    .filter((item) => item.page && item.position >= 4 && item.position <= 20 && item.impressions >= 2)
    .slice(0, 10)
    .map((item, index) => {
      const page = item.page as string;
      const slug = slugFromPage(page);
      const type = experimentType(item);
      const hypothesis =
        type === "title_snippet"
          ? "検索意図をタイトル・冒頭回答へ明示するとCTRが改善する"
          : type === "content_expand"
            ? "検索語への直接回答と一次情報を追加するとTop10到達率が上がる"
            : "関連クラスターから文脈一致の内部リンクを増やすと順位が押し上がる";
      const successMetric =
        type === "title_snippet"
          ? "7/14/28日でCTR上昇、順位悪化なし"
          : "7/14/28日で平均順位改善またはTop10到達";
      return {
        id: `lab-${String(index + 1).padStart(2, "0")}-${slug}`,
        query: item.query,
        page,
        slug,
        position: item.position,
        impressions: item.impressions,
        experimentType: type,
        hypothesis,
        successMetric,
        checkpoints: [7, 14, 28],
        status: "proposal",
        score: item.score,
      };
    });
}

function terms(value: string): Set<string> {
  const normalized = value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\s、。！？「」『』（）()【】\[\]・:：／/｜|,_-]+/g, " ")
    .trim();
  const raw = normalized.split(" ").filter((x) => x.length >= 2);
  const set = new Set<string>(raw);
  for (const token of raw) {
    if (token.length >= 4) {
      for (let i = 0; i <= token.length - 2; i += 1) {
        set.add(token.slice(i, i + 2));
      }
    }
  }
  return set;
}

function similarity(a: Set<string>, b: Set<string>): { score: number; shared: string[] } {
  const shared = [...a].filter((term) => b.has(term));
  const union = new Set([...a, ...b]);
  return {
    score: union.size ? shared.length / union.size : 0,
    shared: shared.filter((term) => term.length >= 2).slice(0, 5),
  };
}

export function buildInternalLinkSuggestions(articles: GrowthArticleInput[]): InternalLinkSuggestion[] {
  const articleTerms = new Map(
    articles.map((article) => [
      article.slug,
      terms(`${article.title} ${article.keyword} ${article.body.slice(0, 1800)}`),
    ])
  );
  const suggestions: InternalLinkSuggestion[] = [];

  for (const source of articles) {
    const sourceTerms = articleTerms.get(source.slug) ?? new Set<string>();
    const existing = new Set(source.outgoing);
    const candidates = articles
      .filter((target) => target.slug !== source.slug && !existing.has(target.slug))
      .map((target) => {
        const sim = similarity(sourceTerms, articleTerms.get(target.slug) ?? new Set<string>());
        const keywordBoost =
          source.keyword && target.keyword && source.keyword.split(/\s+/).some((x) => x.length >= 2 && target.keyword.includes(x))
            ? 0.08
            : 0;
        return { target, sim, score: sim.score + keywordBoost };
      })
      .filter((x) => x.score >= 0.08)
      .sort((a, b) => b.score - a.score)
      .slice(0, source.outgoing.length < 2 ? 3 : 1);

    for (const candidate of candidates) {
      suggestions.push({
        sourceSlug: source.slug,
        targetSlug: candidate.target.slug,
        anchor: candidate.target.keyword || candidate.target.title,
        score: Number(candidate.score.toFixed(3)),
        reason: candidate.sim.shared.length
          ? `共通語: ${candidate.sim.shared.join(" / ")}`
          : "検索意図・キーワードの近接",
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 40);
}

function hasDirectAnswer(article: GrowthArticleInput): boolean {
  const opening = article.body
    .replace(/^#+\s+.*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .trim()
    .slice(0, 900);
  return (
    article.summaryCount > 0 ||
    /(結論|まず|端的に|つまり|ポイント|答えは|限りません|必要です|不要です|確認)/.test(opening)
  );
}

function hasDefinitionStructure(body: string): boolean {
  return /^##\s+.*(とは|意味|違い|結論|確認|ポイント)/m.test(body);
}

function hasDatedEvidence(body: string): boolean {
  return /(20\d{2}[年/-]|令和\d+年|202\d年|調査日|公表日|更新日)/.test(body);
}

export function buildAioScores(articles: GrowthArticleInput[]): AioScore[] {
  return articles
    .map((article) => {
      const checks = {
        directAnswer: hasDirectAnswer(article),
        faq: article.faqCount > 0,
        authoritativeSource: article.hasAuthoritativeSource,
        definitionStructure: hasDefinitionStructure(article.body),
        updateHistory: article.hasUpdateHistory,
        image: article.hasImage,
        comparison: article.hasComparisonTable,
        datedEvidence: hasDatedEvidence(article.body),
      };
      const weights: Record<keyof typeof checks, number> = {
        directAnswer: 20,
        faq: 10,
        authoritativeSource: 20,
        definitionStructure: 10,
        updateHistory: 10,
        image: 10,
        comparison: 5,
        datedEvidence: 15,
      };
      const score = (Object.keys(checks) as Array<keyof typeof checks>)
        .filter((key) => checks[key])
        .reduce((sum, key) => sum + weights[key], 0);
      const labels: Record<keyof typeof checks, string> = {
        directAnswer: "冒頭の直接回答",
        faq: "FAQ",
        authoritativeSource: "一次・公的ソース",
        definitionStructure: "定義/結論型H2",
        updateHistory: "更新履歴",
        image: "記事画像",
        comparison: "比較・整理表",
        datedEvidence: "日付付き根拠",
      };
      const missing = (Object.keys(checks) as Array<keyof typeof checks>)
        .filter((key) => !checks[key])
        .map((key) => labels[key]);
      const grade: AioScore["grade"] = score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";
      return { slug: article.slug, title: article.title, score, grade, checks, missing };
    })
    .sort((a, b) => a.score - b.score || a.slug.localeCompare(b.slug));
}

export function buildResearchOverview(
  sources: ResearchSource[],
  statuses: ResearchSourceStatus[]
): GrowthLabData["research"] {
  const statusMap = new Map(statuses.map((status) => [status.id, status]));
  const joined = sources.map((source) => ({ ...source, status: statusMap.get(source.id) }));
  return {
    configuredSources: sources.length,
    changedSources: joined.filter((item) => item.status?.changed).length,
    failedSources: joined.filter((item) => item.status?.error || (item.status?.httpStatus ?? 200) >= 400).length,
    sources: joined,
  };
}

export function buildGrowthLab(params: {
  gsc: SCData;
  articles: GrowthArticleInput[];
  researchSources: ResearchSource[];
  researchStatuses: ResearchSourceStatus[];
}): GrowthLabData {
  const demandRadar = buildDemandRadar(params.gsc);
  return {
    generatedAt: new Date().toISOString(),
    demandRadar,
    experiments: buildSeoExperiments(demandRadar),
    internalLinks: buildInternalLinkSuggestions(params.articles),
    aioScores: buildAioScores(params.articles),
    research: buildResearchOverview(params.researchSources, params.researchStatuses),
  };
}
