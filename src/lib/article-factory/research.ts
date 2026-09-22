/**
 * 実際のWeb検索による調査フェーズ。
 *
 * INST-003 時点の実装は「検索せずLLMに尋ね、URLの構文だけ検証する」ものだった。
 * 構文として正しいURLは根拠ではないため、ここを実検索に置き換える。
 *
 * 方式:
 *   1. OpenAI Responses API の web_search ツールで実際に検索する。
 *   2. **出典として採用できるのは `url_citation` アノテーションで返ってきたURLだけ**。
 *      モデルが本文中に書いたURLは採用しない（捏造を構造的に排除する）。
 *   3. 検証済みURL集合を提示したうえで、主張 → 出典 の対応付けを別途行う。
 *   4. 検証済み集合に無いURLで支えられた時事的主張は unsupported に落とす。
 *
 * 検索が使えない・失敗した・結果ゼロの場合は、
 * 時事的主張をすべて unsupported として残し、公開をブロックさせる。
 */

import OpenAI from "openai";
import { runStructured, obj, arr, str, bool, strArr } from "@/lib/seo-editor/openai";
import { ARTICLE_FACTORY_MODEL, LIMITS } from "./config";
import type { ResearchResult, ResearchSource, SelectedTopic } from "./types";

/** 検索で実際に引用されたことが確認できた出典 */
export interface VerifiedSource {
  title: string;
  /** 正規化済みURL */
  url: string;
  authoritative: boolean;
}

// ── URL正規化（純粋関数） ──

/** 追跡パラメータ。根拠URLの同一性判定を邪魔するので落とす */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "yclid",
  "msclkid",
  "ref",
  "ref_src",
  "spm",
];

/**
 * 出典URLを比較可能な正規形にする。
 *
 * - http/https 以外は null
 * - ホスト名は小文字化し、先頭の www. を落とす
 * - 既定ポートを落とす
 * - 追跡パラメータを落とし、残りのクエリはキー順に並べ替える
 * - フラグメントを落とす
 * - 末尾スラッシュを落とす（ルートを除く）
 *
 * 正規化できない入力では null を返す。
 */
export function normalizeSourceUrl(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;

  u.hostname = u.hostname.toLowerCase();
  if (u.hostname.startsWith("www.")) u.hostname = u.hostname.slice(4);

  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
    u.port = "";
  }

  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
  u.searchParams.sort();
  u.hash = "";

  let out = u.toString();
  // 末尾スラッシュはルート以外で落とす
  if (u.pathname !== "/" && out.endsWith("/")) out = out.slice(0, -1);
  // クエリが空になった場合の "?" を落とす
  out = out.replace(/\?$/, "");
  return out;
}

/** 一次情報・公的機関とみなすホスト */
const AUTHORITATIVE_SUFFIXES = [
  ".go.jp",
  ".lg.jp",
  ".ac.jp",
  ".gov",
  ".edu",
  "jil.go.jp",
  "e-stat.go.jp",
  "stat.go.jp",
  "mhlw.go.jp",
  "meti.go.jp",
  "soumu.go.jp",
  "jpx.co.jp",
  "iso.org",
  "w3.org",
  "ietf.org",
];

/** 公的機関・標準化団体・一次情報かどうか */
export function isAuthoritativeUrl(url: string): boolean {
  const normalized = normalizeSourceUrl(url);
  if (!normalized) return false;
  let host: string;
  try {
    host = new URL(normalized).hostname;
  } catch {
    return false;
  }
  return AUTHORITATIVE_SUFFIXES.some((s) => host === s.replace(/^\./, "") || host.endsWith(s));
}

/**
 * 同一URLの出典をまとめる。
 *
 * 正規化後のURLが同じものは1件に畳み、supportsClaims を統合する。
 * タイトルは最初に現れた非空のものを採る。
 */
export function dedupeSources(sources: ResearchSource[]): ResearchSource[] {
  const byUrl = new Map<string, ResearchSource>();

  for (const s of sources) {
    const normalized = normalizeSourceUrl(s.url);
    if (!normalized) continue;

    const existing = byUrl.get(normalized);
    if (!existing) {
      byUrl.set(normalized, {
        ...s,
        url: normalized,
        supportsClaims: [...new Set(s.supportsClaims ?? [])],
      });
      continue;
    }

    existing.supportsClaims = [
      ...new Set([...existing.supportsClaims, ...(s.supportsClaims ?? [])]),
    ];
    if (!existing.title && s.title) existing.title = s.title;
    existing.authoritative = existing.authoritative || s.authoritative;
  }

  return [...byUrl.values()];
}

/** 今日（YYYY-MM-DD） */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── 主張と出典の突き合わせ（純粋関数） ──

export interface ClaimMapping {
  claim: string;
  /** その主張を支えるとモデルが主張したURL */
  sourceUrls: string[];
  /** 年度・制度・統計に依存するか */
  timeSensitive: boolean;
}

export interface BuildResearchInput {
  /** 実検索で引用が確認できた出典のみ */
  verified: VerifiedSource[];
  claimMappings: ClaimMapping[];
  /** 検索が実行できたか。false なら時事的主張はすべて unsupported */
  searchAvailable: boolean;
  /** 検索が使えなかった理由（unsupportedClaims に添える） */
  unavailableReason?: string;
}

/**
 * 検証済み出典と主張マッピングから ResearchResult を構築する。
 *
 * 中核の判断:
 *   時事的な主張は、**検証済み集合に含まれるURL**で支えられていなければ
 *   unsupported になる。unsupported が1件でもあればQAが公開を止める。
 */
export function buildResearchResult(input: BuildResearchInput): ResearchResult {
  const { verified, claimMappings, searchAvailable, unavailableReason } = input;

  const verifiedByUrl = new Map<string, VerifiedSource>();
  for (const v of verified) {
    const n = normalizeSourceUrl(v.url);
    if (n) verifiedByUrl.set(n, { ...v, url: n });
  }

  const timeSensitiveClaims: string[] = [];
  const unsupportedClaims: string[] = [];
  const claimsByUrl = new Map<string, Set<string>>();

  for (const m of claimMappings) {
    const claim = (m.claim ?? "").trim();
    if (!claim) continue;

    if (m.timeSensitive) timeSensitiveClaims.push(claim);

    // 検索そのものが使えなかった場合、時事的主張は根拠なしで確定
    if (!searchAvailable) {
      if (m.timeSensitive) {
        unsupportedClaims.push(
          unavailableReason ? `${claim}（${unavailableReason}）` : claim
        );
      }
      continue;
    }

    // 検証済み集合に無いURLは根拠として採用しない
    const supporting = (m.sourceUrls ?? [])
      .map((u) => normalizeSourceUrl(u))
      .filter((u): u is string => u !== null && verifiedByUrl.has(u));

    if (supporting.length === 0) {
      if (m.timeSensitive) {
        unsupportedClaims.push(
          `${claim}（実検索で確認できた出典がありません）`
        );
      }
      continue;
    }

    for (const url of supporting) {
      const set = claimsByUrl.get(url) ?? new Set<string>();
      set.add(claim);
      claimsByUrl.set(url, set);
    }
  }

  // 実際に主張を支えている出典だけを残す
  const sources: ResearchSource[] = [];
  for (const [url, claims] of claimsByUrl) {
    const v = verifiedByUrl.get(url);
    if (!v) continue;
    sources.push({
      title: v.title || url,
      url,
      retrievedAt: today(),
      supportsClaims: [...claims],
      authoritative: v.authoritative,
    });
  }

  return {
    sources: dedupeSources(sources).slice(0, LIMITS.maxSources),
    timeSensitiveClaims: [...new Set(timeSensitiveClaims)],
    unsupportedClaims: [...new Set(unsupportedClaims)],
  };
}

// ── 実検索 ──

export class ResearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchUnavailableError";
  }
}

/** OpenAIのエラーから秘密情報を落とす */
function safeMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.replace(/sk-[A-Za-z0-9_-]{10,}/g, "sk-***").slice(0, 300);
}

interface SearchOutcome {
  verified: VerifiedSource[];
  /** 検索結果の要約テキスト（次段の入力に使う） */
  summary: string;
}

/**
 * web_search ツールで実際に検索し、引用アノテーションから出典を取り出す。
 *
 * 採用するのは `url_citation` アノテーションのURLのみ。
 * 本文中にモデルが書いたURLは無視する。
 */
export async function performWebSearch(topic: SelectedTopic): Promise<SearchOutcome> {
  if (!process.env.OPENAI_API_KEY) {
    throw new ResearchUnavailableError("OPENAI_API_KEY が未設定です");
  }
  const client = new OpenAI();

  let response;
  try {
    response = await client.responses.create({
      model: ARTICLE_FACTORY_MODEL,
      tools: [{ type: "web_search" }],
      // 引用を必ず取りこぼさないようソースも含めて返させる
      include: ["web_search_call.action.sources"],
      instructions: [
        "あなたは日本語メディアNARU（第二新卒 × IT/Web転職）のリサーチャーです。",
        "与えられたトピックについて、最新かつ信頼できる情報をWeb検索で調べてください。",
        "",
        "優先する情報源:",
        "- 日本の公的機関（厚生労働省・総務省・経済産業省・e-Stat など go.jp / lg.jp）",
        "- 企業・製品の公式ドキュメント",
        "- 標準化団体の一次資料",
        "",
        "制度・統計・年度に依存する数値は、必ず出典にあたって確認してください。",
        "確認できなかったことは「確認できなかった」と明記してください。推測で断定しないこと。",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            "<topic>",
            JSON.stringify(
              {
                title: topic.title,
                primaryKeyword: topic.primaryKeyword,
                secondaryKeywords: topic.secondaryKeywords,
                category: topic.category,
              },
              null,
              1
            ),
            "</topic>",
            "",
            "この記事を書くために必要な事実を、出典を確認しながら調べてください。",
          ].join("\n"),
        },
      ],
    });
  } catch (e) {
    throw new ResearchUnavailableError(`Web検索に失敗しました: ${safeMessage(e)}`);
  }

  const verified: VerifiedSource[] = [];
  const seen = new Set<string>();
  const textParts: string[] = [];

  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type !== "output_text") continue;
      textParts.push(content.text);

      for (const annotation of content.annotations ?? []) {
        if (annotation.type !== "url_citation") continue;
        const normalized = normalizeSourceUrl(annotation.url);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        verified.push({
          title: annotation.title || normalized,
          url: normalized,
          authoritative: isAuthoritativeUrl(normalized),
        });
      }
    }
  }

  return { verified, summary: textParts.join("\n\n") };
}

// ── 主張 → 出典 の対応付け ──

const CLAIM_SCHEMA = obj({
  claims: arr(
    obj({
      claim: str,
      sourceUrls: strArr,
      timeSensitive: bool,
    })
  ),
});

interface RawClaims {
  claims: ClaimMapping[];
}

function isRawClaims(v: unknown): v is RawClaims {
  return Boolean(v) && typeof v === "object" && Array.isArray((v as RawClaims).claims);
}

/**
 * 検索結果をもとに、記事で述べる主張と出典を対応付ける。
 *
 * モデルには**検証済みURLの一覧だけ**を提示し、そこから選ばせる。
 * それでも一覧外のURLが返ることはあるため、
 * 最終判断は buildResearchResult（純粋関数）が行う。
 */
async function mapClaimsToSources(
  topic: SelectedTopic,
  outcome: SearchOutcome
): Promise<ClaimMapping[]> {
  const { data } = await runStructured<RawClaims>({
    name: "article_claim_sources",
    instructions: [
      "検索で得られた情報から、記事で述べる主張を列挙し、出典を対応付けてください。",
      "",
      "厳守事項:",
      "- sourceUrls に書いてよいのは、**与えられた検証済みURL一覧に載っているURLだけ**です。",
      "- 一覧に無いURLを書かないでください。思い出したURLを書くこともしないでください。",
      "- 年度・制度・統計・相場など、時期によって変わる主張は timeSensitive: true にしてください。",
      "- 出典で裏が取れない主張は、sourceUrls を空配列にしてください。",
      "  空にすることは正しい振る舞いです。無理に埋めないでください。",
    ].join("\n"),
    input: [
      "<topic>",
      JSON.stringify({ title: topic.title, primaryKeyword: topic.primaryKeyword }, null, 1),
      "</topic>",
      "<verified_urls>",
      JSON.stringify(
        outcome.verified.map((v) => ({ title: v.title, url: v.url })),
        null,
        1
      ),
      "</verified_urls>",
      "<search_summary>",
      outcome.summary.slice(0, 12000),
      "</search_summary>",
    ].join("\n"),
    schema: CLAIM_SCHEMA,
    model: ARTICLE_FACTORY_MODEL,
    validate: isRawClaims,
  });

  return data.claims ?? [];
}

/**
 * 調査フェーズ本体。
 *
 * 検索が使えない場合でも例外にせず、
 * 「時事的主張はすべて根拠なし」という ResearchResult を返して
 * QAに公開を止めさせる（fail closed）。
 */
export async function runResearch(topic: SelectedTopic): Promise<ResearchResult> {
  let outcome: SearchOutcome;
  try {
    outcome = await performWebSearch(topic);
  } catch (e) {
    const reason =
      e instanceof ResearchUnavailableError ? e.message : `Web検索に失敗しました: ${safeMessage(e)}`;
    // 検索が使えないなら、そもそも何が時事的かも確かめられない。
    // 主張を立てずに「検索不可」だけを unsupported として残す。
    return {
      sources: [],
      timeSensitiveClaims: [],
      unsupportedClaims: [reason],
    };
  }

  if (outcome.verified.length === 0) {
    return {
      sources: [],
      timeSensitiveClaims: [],
      unsupportedClaims: [
        "Web検索で引用可能な出典が1件も得られませんでした（出典を創作しないため、根拠なしとして扱います）",
      ],
    };
  }

  let claimMappings: ClaimMapping[];
  try {
    claimMappings = await mapClaimsToSources(topic, outcome);
  } catch (e) {
    return {
      sources: [],
      timeSensitiveClaims: [],
      unsupportedClaims: [`主張と出典の対応付けに失敗しました: ${safeMessage(e)}`],
    };
  }

  return buildResearchResult({
    verified: outcome.verified,
    claimMappings,
    searchAvailable: true,
  });
}
