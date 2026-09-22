/**
 * Article Factory の安全判定。
 *
 * ここにある関数は**すべて純粋関数**で、I/O・LLM・ネットワークに依存しない。
 * 公開を止めるかどうかの判断は必ずここを通す。テストもここを対象にする。
 *
 * 設計意図:
 *   LLMの出力は信用しない。LLMが「問題なし」と言っても、
 *   この層が機械的にFAILを出せばPRは作られるが公開はされない。
 */

import {
  ALLOWED_PERSONA_FACTS,
  KNOWN_CATEGORIES,
  LIMITS,
  REQUIRED_FRONTMATTER_KEYS,
  TOPIC_SCOPE,
  ARTICLES_DIR,
  ARTICLE_RUN_DIR,
  CANDIDATE_BATCH_DIR,
} from "./constants";
import type {
  ArticleCandidate,
  ArticleDraft,
  ArticleFrontmatter,
  QaIssue,
  QaResult,
  QaVerdict,
  ResearchResult,
} from "./types";

// ── スコープ判定 ──

/** 候補がサイトのテーマ境界内かどうか */
export function isInScope(text: string): { ok: boolean; reason: string } {
  const haystack = text.toLowerCase();
  for (const bad of TOPIC_SCOPE.forbidden) {
    if (text.includes(bad)) {
      return { ok: false, reason: `スコープ外の主題を含みます: ${bad}` };
    }
  }
  const hit = TOPIC_SCOPE.requiredAnyOf.some(
    (w) => text.includes(w) || haystack.includes(w.toLowerCase())
  );
  if (!hit) {
    return {
      ok: false,
      reason: `${TOPIC_SCOPE.label} に関係する語が含まれていません`,
    };
  }
  return { ok: true, reason: "" };
}

// ── カニバリゼーション判定 ──

/** 記号を落として比較用に正規化する */
export function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[【】\[\]（）()「」『』・、。,.\-—–ー~〜!！?？:：;；"'`]/g, "")
    .replace(/\s+/g, "");
}

/** キーワードを語に分割する（日本語は2-gram、英数字は単語単位） */
export function tokenize(s: string): string[] {
  const out: string[] = [];
  const cleaned = s.toLowerCase().replace(/[【】\[\]（）()「」『』・、。,.!！?？:：;；"'`]/g, " ");
  for (const chunk of cleaned.split(/\s+/)) {
    if (!chunk) continue;
    if (/^[\w-]+$/.test(chunk)) {
      out.push(chunk);
      continue;
    }
    // 日本語などは2-gramにする
    if (chunk.length === 1) {
      out.push(chunk);
    } else {
      for (let i = 0; i < chunk.length - 1; i++) out.push(chunk.slice(i, i + 2));
    }
  }
  return out;
}

/** Jaccard係数（0〜1） */
export function similarity(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface ExistingArticleRef {
  slug: string;
  title: string;
  keyword: string;
}

export interface CannibalizationVerdict {
  duplicate: boolean;
  /** 最も近い既存記事 */
  nearest: { slug: string; score: number } | null;
  reason: string;
}

/** 重複判定のしきい値。これ以上なら新規作成を止める */
export const DUPLICATE_THRESHOLD = 0.7;

/**
 * 新規トピックが既存記事と重複していないか判定する。
 *
 * slug完全一致、またはタイトル/キーワード類似度が
 * DUPLICATE_THRESHOLD 以上なら重複とみなす。
 */
export function checkCannibalization(
  topic: { title: string; primaryKeyword: string; slug: string },
  existing: ExistingArticleRef[]
): CannibalizationVerdict {
  let nearest: { slug: string; score: number } | null = null;

  for (const e of existing) {
    if (e.slug === topic.slug) {
      return {
        duplicate: true,
        nearest: { slug: e.slug, score: 1 },
        reason: `既存記事と同じslugです: ${e.slug}`,
      };
    }
    const titleScore = similarity(topic.title, e.title);
    const keywordScore = similarity(topic.primaryKeyword, e.keyword);
    const score = Math.max(titleScore, keywordScore);
    if (!nearest || score > nearest.score) nearest = { slug: e.slug, score };
  }

  if (nearest && nearest.score >= DUPLICATE_THRESHOLD) {
    return {
      duplicate: true,
      nearest,
      reason: `既存記事 ${nearest.slug} と検索意図が重複しています（類似度 ${nearest.score.toFixed(2)}）`,
    };
  }
  return { duplicate: false, nearest, reason: "" };
}

// ── 一人称の実体験の検出 ──

/**
 * 許可された一次情報を超える一人称の主張を検出する。
 *
 * 方針: 一人称マーカー（僕/私/自分）を含む文を取り出し、
 * その文が ALLOWED_PERSONA_FACTS のいずれとも結びつかず、
 * かつ具体的な体験主張の形をしている場合に違反とみなす。
 */
export function findUnsupportedPersonalClaims(body: string): string[] {
  const violations: string[] = [];

  // 文単位に分割
  const sentences = body
    .replace(/```[\s\S]*?```/g, " ") // コードブロックを除外
    .split(/(?<=[。！？\n])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const firstPerson = /(僕|私|自分|筆者)(は|が|も|の|に|を|と|から|まで)?/;

  // 具体的な体験を断定する語（一人称と結びつくと実体験の主張になる）
  const experienceMarkers =
    /(経験しました|体験しました|働いていました|勤めていました|在籍していました|転職しました|入社しました|退職しました|受けました|使いました|利用しました|使っていました|通いました|取得しました|合格しました|落ちました|内定をもらいました|面接を受けました|応募しました|年収が|年収は|給料が|給料は|上司が|同僚が|当時の|新卒で|前職で|現職で)/;

  for (const s of sentences) {
    if (!firstPerson.test(s)) continue;
    if (!experienceMarkers.test(s)) continue;
    if (isSupportedByPersona(s)) continue;
    violations.push(s.length > 120 ? `${s.slice(0, 120)}…` : s);
  }
  return violations;
}

/** 文が許可された一次情報の範囲で説明できるか */
export function isSupportedByPersona(sentence: string): boolean {
  // 許可された事実に含まれる特徴語
  const supported = [
    "磯貝アルト",
    "24歳",
    "飲食",
    "第二新卒",
    "IT",
    "Web",
    "30社",
    "内定2社",
    "2社",
    "350",
    "400",
    "AIO",
    "法人営業",
    "doda",
    "ワークポート",
  ];
  return supported.some((w) => sentence.includes(w));
}

/** 許可された一次情報の一覧（プロンプト・レポート用） */
export function allowedPersonaFacts(): readonly string[] {
  return ALLOWED_PERSONA_FACTS;
}

// ── frontmatter 検証 ──

export interface FrontmatterCheck {
  ok: boolean;
  missing: string[];
  malformed: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 必須frontmatterの有無と形式を機械的に検証する */
export function checkFrontmatter(fm: Partial<ArticleFrontmatter> | null): FrontmatterCheck {
  const missing: string[] = [];
  const malformed: string[] = [];

  if (!fm || typeof fm !== "object") {
    return { ok: false, missing: [...REQUIRED_FRONTMATTER_KEYS], malformed: [] };
  }

  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    if (!(key in fm) || fm[key as keyof ArticleFrontmatter] === undefined) missing.push(key);
  }

  if (typeof fm.title !== "string" || fm.title.trim() === "") {
    if (!missing.includes("title")) malformed.push("title");
  }
  if (typeof fm.category !== "string" || !KNOWN_CATEGORIES.includes(fm.category as never)) {
    if (!missing.includes("category")) {
      malformed.push(`category（許可: ${KNOWN_CATEGORIES.join(" / ")}）`);
    }
  }
  if (typeof fm.keyword !== "string" || fm.keyword.trim() === "") {
    if (!missing.includes("keyword")) malformed.push("keyword");
  }
  if (typeof fm.excerpt !== "string" || fm.excerpt.trim() === "") {
    if (!missing.includes("excerpt")) malformed.push("excerpt");
  }
  for (const dateKey of ["datePublished", "dateModified"] as const) {
    const v = fm[dateKey];
    if (v !== undefined && (typeof v !== "string" || !DATE_RE.test(v))) {
      malformed.push(`${dateKey}（YYYY-MM-DD形式ではありません）`);
    }
  }
  if (fm.summary !== undefined && (!Array.isArray(fm.summary) || fm.summary.length === 0)) {
    malformed.push("summary（1件以上の配列が必要）");
  }
  if (fm.faq !== undefined) {
    if (!Array.isArray(fm.faq)) {
      malformed.push("faq（配列が必要）");
    } else {
      const bad = fm.faq.some(
        (f) =>
          !f ||
          typeof f !== "object" ||
          typeof f.question !== "string" ||
          typeof f.answer !== "string" ||
          f.question.trim() === "" ||
          f.answer.trim() === ""
      );
      if (bad) malformed.push("faq（question/answerが揃っていない項目があります）");
    }
  }
  if (fm.cta_agents !== undefined && !Array.isArray(fm.cta_agents)) {
    malformed.push("cta_agents（配列が必要）");
  }
  if (fm.note_published !== undefined && typeof fm.note_published !== "boolean") {
    malformed.push("note_published（boolean が必要）");
  }

  return { ok: missing.length === 0 && malformed.length === 0, missing, malformed };
}

// ── 内部リンク検証 ──

/** 本文から内部リンクのパスを抽出する */
export function extractInternalLinkPaths(body: string): string[] {
  const out: string[] = [];
  const re = /\[[^\]]*?\]\((\/[^)\s]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push(m[1].split(/[?#]/)[0]);
  }
  return [...new Set(out)];
}

/** 実在しない内部リンクを返す */
export function findBrokenInternalLinks(body: string, knownPaths: Set<string>): string[] {
  return extractInternalLinkPaths(body).filter((p) => !knownPaths.has(p));
}

// ── パス許可リスト ──

const ARTICLE_PATH_RE = new RegExp(`^${ARTICLES_DIR}/[a-z0-9-]+\\.md$`);
const RUN_PATH_RE = new RegExp(`^${ARTICLE_RUN_DIR}/[\\w.-]+\\.(json|md)$`);
const BATCH_PATH_RE = new RegExp(`^${CANDIDATE_BATCH_DIR}/[\\w.-]+\\.json$`);

/**
 * 書き込みを許可するパスかどうか。
 *
 * 記事ソース・Run記録・候補バッチ以外への書き込みは一切認めない。
 * `..` を含むパスは常に拒否する。
 */
export function isAllowedPath(p: string): boolean {
  if (!p || p.includes("..") || p.startsWith("/")) return false;
  if (p.includes("\\")) return false;
  return ARTICLE_PATH_RE.test(p) || RUN_PATH_RE.test(p) || BATCH_PATH_RE.test(p);
}

/** 変更セット全体のパス検証。許可されないパスを返す */
export function findForbiddenPaths(paths: string[]): string[] {
  return paths.filter((p) => !isAllowedPath(p));
}

// ── slug 検証 ──

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 80;
}

/**
 * 既存記事を上書きしようとしていないか。
 * 上書きは常に拒否する（新規記事オートパイロットは新規作成専用）。
 */
export function refusesSlugOverwrite(slug: string, existingSlugs: string[]): boolean {
  return existingSlugs.includes(slug);
}

// ── Cron 認証 ──

/**
 * Vercel Cron の Authorization ヘッダを検証する。
 *
 * secret が未設定なら**常に拒否**する（fail closed）。
 * 既定値を持たせて意図せず公開状態になることを防ぐ。
 */
export function isValidCronAuth(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!authorizationHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authorizationHeader.length !== expected.length) return false;
  // 長さ一致を確認したうえで定数時間比較する
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= authorizationHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ── QA 集約 ──

function worst(a: QaVerdict, b: QaVerdict): QaVerdict {
  const rank: Record<QaVerdict, number> = { PASS: 0, NEEDS_REVIEW: 1, FAIL: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export interface QaInput {
  draft: ArticleDraft;
  research: ResearchResult;
  existing: ExistingArticleRef[];
  existingSlugs: string[];
  knownPaths: Set<string>;
  changePaths: string[];
  /** build / typecheck の結果。未実行なら null */
  buildPassed: boolean | null;
}

/**
 * 決定的なQA。LLMを介さず、機械的に判定できるものだけを見る。
 *
 * ここでFAIL/NEEDS_REVIEWが1件でも出れば公開はブロックされる。
 */
export function runQa(input: QaInput): QaResult {
  const issues: QaIssue[] = [];
  const { draft, research, existing, existingSlugs, knownPaths, changePaths, buildPassed } = input;

  // slug
  if (!isValidSlug(draft.slug)) {
    issues.push({
      category: "slug-collision",
      verdict: "FAIL",
      target: draft.slug,
      message: "slugの形式が不正です（英小文字・数字・ハイフンのみ）",
    });
  }
  if (refusesSlugOverwrite(draft.slug, existingSlugs)) {
    issues.push({
      category: "slug-collision",
      verdict: "FAIL",
      target: draft.slug,
      message: "既存記事と同じslugのため上書きを拒否しました",
    });
  }

  // スコープ
  const scope = isInScope(`${draft.frontmatter.title} ${draft.frontmatter.keyword}`);
  if (!scope.ok) {
    issues.push({
      category: "scope",
      verdict: "FAIL",
      target: draft.slug,
      message: scope.reason,
    });
  }

  // カニバリ
  const cannibal = checkCannibalization(
    {
      title: draft.frontmatter.title,
      primaryKeyword: draft.frontmatter.keyword,
      slug: draft.slug,
    },
    existing
  );
  if (cannibal.duplicate) {
    issues.push({
      category: "cannibalization",
      verdict: "FAIL",
      target: cannibal.nearest?.slug ?? draft.slug,
      message: cannibal.reason,
    });
  }

  // frontmatter
  const fm = checkFrontmatter(draft.frontmatter);
  if (!fm.ok) {
    issues.push({
      category: "frontmatter",
      verdict: "FAIL",
      target: draft.slug,
      message: `frontmatterが不正です — 欠落: ${fm.missing.join(", ") || "なし"} / 形式不正: ${
        fm.malformed.join(", ") || "なし"
      }`,
    });
  }

  // 内部リンク
  const broken = findBrokenInternalLinks(draft.body, knownPaths);
  for (const b of broken) {
    issues.push({
      category: "internal-links",
      verdict: "FAIL",
      target: b,
      message: "実在しない内部リンクです",
    });
  }

  // 一人称の実体験
  const personal = findUnsupportedPersonalClaims(draft.body);
  for (const p of personal) {
    issues.push({
      category: "personal-experience",
      verdict: "FAIL",
      target: draft.slug,
      message: `許可された一次情報を超える一人称の記述です: 「${p}」`,
    });
  }

  // 出典
  for (const claim of research.unsupportedClaims) {
    issues.push({
      category: "sources",
      verdict: "FAIL",
      target: claim.slice(0, 60),
      message: "時事性のある主張に出典がありません",
    });
  }
  if (research.timeSensitiveClaims.length > 0 && research.sources.length === 0) {
    issues.push({
      category: "sources",
      verdict: "FAIL",
      target: draft.slug,
      message: "時事性のある主張があるのに出典が1件もありません",
    });
  }

  // パス許可リスト
  for (const p of findForbiddenPaths(changePaths)) {
    issues.push({
      category: "paths",
      verdict: "FAIL",
      target: p,
      message: "許可されていない書き込みパスです",
    });
  }

  // 文字数（薄い記事を止める）
  if (draft.charCount < LIMITS.minArticleChars) {
    issues.push({
      category: "build",
      verdict: "NEEDS_REVIEW",
      target: draft.slug,
      message: `本文が短すぎます（${draft.charCount}字 / 最低${LIMITS.minArticleChars}字）`,
    });
  }

  // build / typecheck
  if (buildPassed === false) {
    issues.push({
      category: "build",
      verdict: "FAIL",
      target: draft.slug,
      message: "build / typecheck に失敗しました",
    });
  } else if (buildPassed === null) {
    issues.push({
      category: "build",
      verdict: "NEEDS_REVIEW",
      target: draft.slug,
      message: "build / typecheck が未実行です",
    });
  }

  const overall = issues.reduce<QaVerdict>((acc, i) => worst(acc, i.verdict), "PASS");
  return { overall, issues, checkedAt: new Date().toISOString() };
}

/**
 * 自動公開してよいか。
 *
 * QAが PASS 以外（FAIL も NEEDS_REVIEW も）なら公開しない。
 * サーバー側の明示フラグが無ければ、QAが通っていても公開しない。
 */
export function canAutoPublish(
  qa: QaResult | null,
  autoPublishAuthorized: boolean
): { allowed: boolean; reason: string } {
  if (!qa) return { allowed: false, reason: "QAが実行されていません" };

  const fails = qa.issues.filter((i) => i.verdict === "FAIL");
  if (fails.length > 0) {
    const sample = fails
      .slice(0, 3)
      .map((i) => `${i.category}: ${i.target}`)
      .join(" / ");
    return { allowed: false, reason: `QAでFAILが${fails.length}件あります — ${sample}` };
  }

  const needsReview = qa.issues.filter((i) => i.verdict === "NEEDS_REVIEW");
  if (needsReview.length > 0) {
    const sample = needsReview
      .slice(0, 3)
      .map((i) => `${i.category}: ${i.target}`)
      .join(" / ");
    return {
      allowed: false,
      reason: `QAでNEEDS_REVIEWが${needsReview.length}件あります — ${sample}`,
    };
  }

  if (qa.overall !== "PASS") {
    return { allowed: false, reason: `QA総合判定が ${qa.overall} です` };
  }

  if (!autoPublishAuthorized) {
    return {
      allowed: false,
      reason:
        "自動公開はサーバー側で許可されていません（ARTICLE_FACTORY_AUTO_PUBLISH が未設定）。PRは作成済みのため、人間がレビューしてマージしてください",
    };
  }

  return { allowed: true, reason: "" };
}

// ── 候補の機械判定 ──

/**
 * LLMが返した候補を機械的に検証し、blocked を確定させる。
 * LLMの自己申告（riskFlags）は参考値として扱い、判断はここで行う。
 */
export function validateCandidate(
  candidate: ArticleCandidate,
  existing: ExistingArticleRef[]
): ArticleCandidate {
  const reasons: string[] = [];
  const flags = new Set(candidate.riskFlags);

  const scope = isInScope(`${candidate.title} ${candidate.primaryKeyword}`);
  if (!scope.ok) {
    reasons.push(scope.reason);
    flags.add("OUT_OF_SCOPE");
  }

  if (!isValidSlug(candidate.proposedSlug)) {
    reasons.push(`slugの形式が不正です: ${candidate.proposedSlug}`);
  }

  const cannibal = checkCannibalization(
    {
      title: candidate.title,
      primaryKeyword: candidate.primaryKeyword,
      slug: candidate.proposedSlug,
    },
    existing
  );
  if (cannibal.duplicate) {
    reasons.push(cannibal.reason);
    flags.add("CANNIBALIZATION");
  }

  if (!candidate.searchEvidence) flags.add("NO_SEARCH_EVIDENCE");

  return {
    ...candidate,
    riskFlags: [...flags],
    nearestExistingSlugs: cannibal.nearest ? [cannibal.nearest.slug] : [],
    blocked: reasons.length > 0,
    blockedReasons: reasons,
  };
}
