/**
 * PHASE 9 — QA
 *
 * 機械的に判定できるもの（FRONTMATTER / BROKEN_LINK / INTERNAL_LINK / DUPLICATION）は
 * コードで検査し、LLMには FACT / EXPERIENCE / SEARCH_INTENT / CANNIBALIZATION だけを任せる。
 * FACT / EXPERIENCE の基準は scripts/proofread.js の思想を再利用している。
 *
 * FAILが1件でもあれば本番反映（PR作成）は不可。
 */

import { runStructured } from "../openai";
import { QA_SCHEMA } from "../schemas/qa";
import { QA_PROMPT } from "../prompts/qa";
import { worstVerdict } from "../qa/proofread-core";
import { getExperienceNotes, getKnownPathnames } from "../corpus";
import { LIMITS } from "../config";
import { asJsonBlock, truncate, wrapUntrusted } from "../sanitize";
import {
  checkFrontmatter,
  extractAllSiteLinks,
  findDuplicateParagraphs,
  parseArticle,
} from "../markdown";
import type {
  ArticleChange,
  QaCategory,
  QaIssue,
  QaResult,
  QaVerdict,
  SeoRun,
  SeoUsage,
} from "@/types/seo-editor";

export interface QaPhaseResult {
  qa: QaResult;
  usage: SeoUsage[];
  warnings: string[];
}

/** LLM検査を行う記事数の上限（並列実行するため所要時間は最長の1件分） */
const MAX_LLM_TARGETS = 4;

interface QaLlmOutput {
  overall: QaVerdict;
  issues: {
    category: "FACT" | "EXPERIENCE" | "SEARCH_INTENT" | "CANNIBALIZATION";
    verdict: QaVerdict;
    location: string;
    message: string;
    evidence: string;
    factCategory: "CONTRADICTION" | "UNSUPPORTED" | "AMBIGUOUS" | "NONE";
  }[];
  summary: string;
  externalVerificationItems: string[];
}

export async function runQaPhase(run: SeoRun): Promise<QaPhaseResult> {
  const warnings: string[] = [];
  const issues: QaIssue[] = [];

  if (run.changes.length === 0) {
    return {
      qa: {
        overall: "NEEDS_REVIEW",
        issues: [
          {
            category: "SEARCH_INTENT",
            verdict: "NEEDS_REVIEW",
            target: "-",
            location: "-",
            message: "変更が1件も生成されていません。方針を見直してください。",
            evidence: "",
          },
        ],
        summary: "変更セットが空のため、反映する内容がありません。",
        byCategory: { SEARCH_INTENT: "NEEDS_REVIEW" },
      },
      usage: [],
      warnings: ["変更が0件です"],
    };
  }

  // ── 機械的検査 ──
  issues.push(...checkDeterministic(run));

  // ── LLM検査（Phase 7 の生成・改稿記事のみ） ──
  const llmTargets = run.changes.filter((c) => c.phase === "write").slice(0, MAX_LLM_TARGETS);
  const skipped = run.changes.filter((c) => c.phase === "write").length - llmTargets.length;
  if (skipped > 0) {
    warnings.push(`LLM検査は上位${MAX_LLM_TARGETS}件のみ実施しました（未検査 ${skipped}件）`);
    issues.push({
      category: "FACT",
      verdict: "NEEDS_REVIEW",
      target: "-",
      location: "-",
      message: `変更ファイルが多いため、${skipped}件は事実整合性の自動検査を行っていません`,
      evidence: "",
    });
  }

  const usage: SeoUsage[] = [];
  const results = await Promise.allSettled(llmTargets.map((change) => inspectChange(run, change)));

  results.forEach((res, i) => {
    const change = llmTargets[i];
    if (res.status === "rejected") {
      warnings.push(
        `${change.path}: QAのLLM検査に失敗しました（${res.reason instanceof Error ? res.reason.message : String(res.reason)}）`
      );
      issues.push({
        category: "FACT",
        verdict: "NEEDS_REVIEW",
        target: change.path,
        location: "-",
        message: "事実整合性の自動検査を完了できませんでした。人間の確認が必要です。",
        evidence: "",
      });
      return;
    }
    usage.push(res.value.usage);
    for (const it of res.value.out.issues) {
      issues.push({
        category: it.category,
        verdict: it.verdict,
        target: change.path,
        location: it.location,
        message: it.message,
        evidence: it.evidence,
        ...(it.factCategory !== "NONE" ? { factCategory: it.factCategory } : {}),
      });
    }
    for (const ext of res.value.out.externalVerificationItems) {
      issues.push({
        category: "FACT",
        verdict: "NEEDS_REVIEW",
        target: change.path,
        location: "-",
        message: `外部情報による確認が必要: ${ext}`,
        evidence: "",
        factCategory: "UNSUPPORTED",
      });
    }
  });

  const byCategory: QaResult["byCategory"] = {};
  for (const issue of issues) {
    byCategory[issue.category] = worstVerdict([byCategory[issue.category] ?? "PASS", issue.verdict]);
  }

  const overall = worstVerdict(issues.map((i) => i.verdict));
  const failCount = issues.filter((i) => i.verdict === "FAIL").length;
  const reviewCount = issues.filter((i) => i.verdict === "NEEDS_REVIEW").length;

  const summary =
    overall === "PASS"
      ? `${run.changes.length}件の変更を検査し、重大な問題は見つかりませんでした。`
      : overall === "FAIL"
        ? `FAIL ${failCount}件、NEEDS_REVIEW ${reviewCount}件。本番反映（PR作成）はできません。`
        : `NEEDS_REVIEW ${reviewCount}件。内容を確認したうえでPRを作成してください。`;

  return { qa: { overall, issues, summary, byCategory }, usage, warnings };
}

// ──────────────────────────────────────────
// 機械的検査
// ──────────────────────────────────────────

function checkDeterministic(run: SeoRun): QaIssue[] {
  const issues: QaIssue[] = [];

  // このRunで新規作成される記事も、リンク先として実在扱いにする
  const known = getKnownPathnames();
  for (const c of run.changes) {
    if (c.operation !== "CREATE") continue;
    const m = c.path.match(/^content\/articles\/([\w-]+)\.md$/);
    if (m) known.add(`/articles/${m[1]}`);
  }

  for (const change of run.changes) {
    if (change.operation === "DELETE") continue;

    // FRONTMATTER
    for (const msg of checkFrontmatter(change.after)) {
      issues.push({
        category: "FRONTMATTER",
        verdict: "FAIL",
        target: change.path,
        location: "frontmatter",
        message: msg,
        evidence: "",
      });
    }

    let body: string;
    try {
      body = parseArticle(change.after).content;
    } catch {
      issues.push({
        category: "FRONTMATTER",
        verdict: "FAIL",
        target: change.path,
        location: "frontmatter",
        message: "Markdownをパースできません",
        evidence: "",
      });
      continue;
    }

    // BROKEN_LINK
    for (const link of extractAllSiteLinks(body)) {
      const href = link.href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
      if (!known.has(href)) {
        issues.push({
          category: "BROKEN_LINK",
          verdict: "FAIL",
          target: change.path,
          location: `[${link.anchor}](${link.href})`,
          message: `存在しないサイト内URLへのリンクです: ${link.href}`,
          evidence: "",
        });
      }
    }

    // DUPLICATION
    for (const dup of findDuplicateParagraphs(body)) {
      issues.push({
        category: "DUPLICATION",
        verdict: "NEEDS_REVIEW",
        target: change.path,
        location: dup,
        message: "同一の段落が本文中で重複しています",
        evidence: dup,
      });
    }

    // EXPERIENCE（保持宣言した一次体験の消失）
    for (const lost of change.lostSegments) {
      issues.push({
        category: "EXPERIENCE",
        verdict: "FAIL",
        target: change.path,
        location: lost.slice(0, 40),
        message: "保持すると宣言された一次体験が本文に残っていません",
        evidence: lost,
        factCategory: "CONTRADICTION",
      });
    }
  }

  // INTERNAL_LINK（計画したリンクが実際に反映されているか）
  const changeByPath = new Map(run.changes.map((c) => [c.path, c]));
  for (const link of run.internalLinks?.links ?? []) {
    const m = link.source.match(/^\/articles\/([\w-]+)$/);
    if (!m) continue;
    const path = `content/articles/${m[1]}.md`;
    const change = changeByPath.get(path);
    if (!change) {
      issues.push({
        category: "INTERNAL_LINK",
        verdict: "NEEDS_REVIEW",
        target: path,
        location: `${link.source} → ${link.target}`,
        message: "計画された内部リンクが、変更セットに反映されていません",
        evidence: link.reason,
      });
      continue;
    }
    const has = change.after.includes(`](${link.target})`);
    if (link.operation === "ADD" && !has) {
      issues.push({
        category: "INTERNAL_LINK",
        verdict: "NEEDS_REVIEW",
        target: path,
        location: `${link.source} → ${link.target}`,
        message: "ADD予定の内部リンクが本文に見つかりません",
        evidence: link.anchor,
      });
    }
    if (link.operation === "REMOVE" && has) {
      issues.push({
        category: "INTERNAL_LINK",
        verdict: "NEEDS_REVIEW",
        target: path,
        location: `${link.source} → ${link.target}`,
        message: "REMOVE予定の内部リンクが残っています",
        evidence: link.anchor,
      });
    }
  }

  // 上限超過
  if (run.changes.length > LIMITS.maxChanges) {
    issues.push({
      category: "DUPLICATION",
      verdict: "FAIL",
      target: "-",
      location: "-",
      message: `変更ファイル数が上限（${LIMITS.maxChanges}）を超えています: ${run.changes.length}件`,
      evidence: "",
    });
  }

  return issues;
}

// ──────────────────────────────────────────
// LLM検査
// ──────────────────────────────────────────

async function inspectChange(
  run: SeoRun,
  change: ArticleChange
): Promise<{ out: QaLlmOutput; usage: SeoUsage }> {
  const slugMatch = change.path.match(/^content\/articles\/([\w-]+)\.md$/);
  const slug = slugMatch ? slugMatch[1] : change.path;
  const brief = run.briefs.find((b) => b.target === slug) ?? null;

  const siblings = (run.clusterAudit?.nodes ?? [])
    .filter((n) => n.slug !== slug)
    .map((n) => ({ slug: n.slug, title: n.title, role: n.role, note: n.note }));

  const input = [
    "# タスク",
    "",
    `変更後の記事「${slug}」を検査してください。`,
    "",
    "## SEO Brief（検索意図の基準）",
    asJsonBlock("untrusted_seo_brief", brief ?? "（Briefなし）"),
    "",
    "## 同一クラスターの他記事（カニバリ判定用）",
    asJsonBlock("untrusted_cluster_siblings", siblings),
    "",
    "## 実話データ（本人情報の正本）",
    wrapUntrusted("untrusted_experience_notes", getExperienceNotes()),
    "",
    change.before ? "## 変更前の記事" : "",
    change.before
      ? wrapUntrusted("untrusted_article_before", truncate(change.before, LIMITS.maxBodyChars))
      : "",
    "",
    "## 変更後の記事",
    wrapUntrusted("untrusted_article_after", truncate(change.after, LIMITS.maxBodyChars * 2)),
  ]
    .filter(Boolean)
    .join("\n");

  const { data, usage } = await runStructured<QaLlmOutput>({
    name: "seo_qa_result",
    instructions: QA_PROMPT,
    input,
    schema: QA_SCHEMA,
  });

  return { out: data, usage };
}

/** 反映可否。FAILが1件でもあれば不可 */
export function canPublish(qa: QaResult | null): { allowed: boolean; reason: string } {
  if (!qa) return { allowed: false, reason: "QAが実行されていません" };
  if (qa.overall === "FAIL") {
    const fails = qa.issues.filter((i) => i.verdict === "FAIL").length;
    return { allowed: false, reason: `QAでFAILが${fails}件あります。本番反映はできません` };
  }
  return { allowed: true, reason: "" };
}

export type { QaCategory };
