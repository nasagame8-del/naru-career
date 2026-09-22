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
import { verdictForOrigin, worstVerdict } from "../qa/proofread-core";
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
  QaOrigin,
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
    origin: QaOrigin;
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
            origin: "INTRODUCED",
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
      origin: "UNKNOWN",
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
        origin: "UNKNOWN",
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
      // 変更前が無い（新規作成）なら、指摘はすべて今回の変更に起因する
      const origin: QaOrigin = change.before === null ? "INTRODUCED" : it.origin;
      issues.push({
        category: it.category,
        origin,
        verdict: verdictForOrigin(origin, it.verdict),
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
        origin: "UNKNOWN",
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
  const warnCount = issues.filter((i) => i.verdict === "WARNING").length;
  const preExisting = `既存の問題（今回の変更が原因ではないもの）${warnCount}件は警告として表示し、反映のブロック理由にはしていません。`;

  const summary =
    overall === "PASS"
      ? `${run.changes.length}件の変更を検査し、今回の変更が新たに発生させた問題はありませんでした。`
      : overall === "FAIL"
        ? `今回の変更が新規発生・悪化させた問題が${failCount}件あります。本番反映（PR作成）はできません。${warnCount > 0 ? preExisting : ""}`
        : overall === "NEEDS_REVIEW"
          ? `要確認${reviewCount}件。今回の変更が新たに壊した箇所はありません。${warnCount > 0 ? preExisting : ""}内容を確認したうえでPRを作成してください。`
          : `今回の変更が新たに発生させた問題はありません。${preExisting}`;

  return { qa: { overall, issues, summary, byCategory }, usage, warnings };
}

// ──────────────────────────────────────────
// 機械的検査
// ──────────────────────────────────────────

/**
 * 機械的検査。
 *
 * 判定基準は「問題が存在するか」ではなく
 * 「今回のChange Setが問題を新規発生・悪化させたか」。
 * そのため必ず before と after の両方を同じ検査にかけ、差分で origin を決める。
 */
function checkDeterministic(run: SeoRun): QaIssue[] {
  const issues: QaIssue[] = [];

  // このRunで新規作成される記事も、リンク先として実在扱いにする
  const known = getKnownPathnames();
  for (const c of run.changes) {
    if (c.operation !== "CREATE") continue;
    const m = c.path.match(/^content\/articles\/([\w-]+)\.md$/);
    if (m) known.add(`/articles/${m[1]}`);
  }

  const brokenLinksOf = (body: string): Map<string, string> => {
    const out = new Map<string, string>();
    for (const link of extractAllSiteLinks(body)) {
      const href = link.href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
      if (!known.has(href)) out.set(href, `[${link.anchor}](${link.href})`);
    }
    return out;
  };

  const push = (
    issue: Omit<QaIssue, "verdict" | "origin"> & { severity: QaVerdict; origin: QaOrigin }
  ) => {
    const { severity, origin, ...rest } = issue;
    issues.push({ ...rest, origin, verdict: verdictForOrigin(origin, severity) });
  };

  for (const change of run.changes) {
    if (change.operation === "DELETE") continue;
    const isNew = change.before === null;

    let afterBody: string;
    try {
      afterBody = parseArticle(change.after).content;
    } catch {
      push({
        category: "FRONTMATTER",
        severity: "FAIL",
        origin: "INTRODUCED",
        target: change.path,
        location: "frontmatter",
        message: "Markdownをパースできません",
        evidence: "",
      });
      continue;
    }
    let beforeBody = "";
    if (!isNew) {
      try {
        beforeBody = parseArticle(change.before!).content;
      } catch {
        beforeBody = "";
      }
    }

    // ── FRONTMATTER ──
    const afterFm = checkFrontmatter(change.after);
    const beforeFm = isNew ? new Set<string>() : new Set(checkFrontmatter(change.before!));
    for (const msg of afterFm) {
      push({
        category: "FRONTMATTER",
        severity: "FAIL",
        origin: isNew || !beforeFm.has(msg) ? "INTRODUCED" : "PRE_EXISTING",
        target: change.path,
        location: "frontmatter",
        message: msg,
        evidence: "",
      });
    }

    // ── BROKEN_LINK ──
    const afterBroken = brokenLinksOf(afterBody);
    const beforeBroken = isNew ? new Map<string, string>() : brokenLinksOf(beforeBody);
    for (const [href, location] of afterBroken) {
      const preExisting = beforeBroken.has(href);
      push({
        category: "BROKEN_LINK",
        severity: "FAIL",
        origin: preExisting ? "PRE_EXISTING" : "INTRODUCED",
        target: change.path,
        location,
        message: preExisting
          ? `変更前から存在する壊れたサイト内リンクです（今回の変更で追加したものではありません）: ${href}`
          : `存在しないサイト内URLへのリンクです: ${href}`,
        evidence: "",
      });
    }

    // ── DUPLICATION ──
    const afterDupes = findDuplicateParagraphs(afterBody);
    const beforeDupes = new Set(isNew ? [] : findDuplicateParagraphs(beforeBody));
    for (const dup of afterDupes) {
      push({
        category: "DUPLICATION",
        severity: "NEEDS_REVIEW",
        origin: isNew || !beforeDupes.has(dup) ? "INTRODUCED" : "PRE_EXISTING",
        target: change.path,
        location: dup,
        message: "同一の段落が本文中で重複しています",
        evidence: dup,
      });
    }

    // ── EXPERIENCE（保持宣言した一次体験の消失）──
    // 今回の変更で失われたものなので、常に INTRODUCED
    for (const lost of change.lostSegments) {
      push({
        category: "EXPERIENCE",
        severity: "FAIL",
        origin: "INTRODUCED",
        target: change.path,
        location: lost.slice(0, 40),
        message: "保持すると宣言された一次体験が本文に残っていません",
        evidence: lost,
        factCategory: "CONTRADICTION",
      });
    }

    // ── MERGE の人間判断（自動削除・自動redirectはしない）──
    if (change.needsHumanDecision) {
      push({
        category: "SEARCH_INTENT",
        severity: "NEEDS_REVIEW",
        origin: "INTRODUCED",
        target: change.path,
        location: "-",
        message: `人間の判断が必要な変更です: ${change.note || "詳細はChange Setの注記を参照"}`,
        evidence: "",
      });
    }
  }

  // ── MERGE判断が含まれる場合は必ず人間レビューへ回す ──
  for (const d of run.actionDecision?.decisions ?? []) {
    if (d.action !== "MERGE") continue;
    push({
      category: "CANNIBALIZATION",
      severity: "NEEDS_REVIEW",
      origin: "INTRODUCED",
      target: `content/articles/${d.target}.md`,
      location: "-",
      message:
        `記事統合（MERGE）が含まれています。統合元 ${d.mergeInto ?? "-"} の削除・301リダイレクト・canonicalは` +
        `自動実行しません。統合可否を含めて人間がレビューしてください。`,
      evidence: d.reason,
    });
  }

  // ── INTERNAL_LINK（今回の計画が反映されているか。すべて今回の変更に起因する）──
  const changeByPath = new Map(run.changes.map((c) => [c.path, c]));
  for (const link of run.internalLinks?.links ?? []) {
    const m = link.source.match(/^\/articles\/([\w-]+)$/);
    if (!m) continue;
    const path = `content/articles/${m[1]}.md`;
    const change = changeByPath.get(path);
    if (!change) {
      push({
        category: "INTERNAL_LINK",
        severity: "NEEDS_REVIEW",
        origin: "INTRODUCED",
        target: path,
        location: `${link.source} → ${link.target}`,
        message: "計画された内部リンクが、変更セットに反映されていません",
        evidence: link.reason,
      });
      continue;
    }
    const has = change.after.includes(`](${link.target})`);
    if (link.operation === "ADD" && !has) {
      push({
        category: "INTERNAL_LINK",
        severity: "NEEDS_REVIEW",
        origin: "INTRODUCED",
        target: path,
        location: `${link.source} → ${link.target}`,
        message: "ADD予定の内部リンクが本文に見つかりません",
        evidence: link.anchor,
      });
    }
    if (link.operation === "REMOVE" && has) {
      push({
        category: "INTERNAL_LINK",
        severity: "NEEDS_REVIEW",
        origin: "INTRODUCED",
        target: path,
        location: `${link.source} → ${link.target}`,
        message: "REMOVE予定の内部リンクが残っています",
        evidence: link.anchor,
      });
    }
  }

  // 上限超過（今回のRunが作った状態）
  if (run.changes.length > LIMITS.maxChanges) {
    push({
      category: "DUPLICATION",
      severity: "FAIL",
      origin: "INTRODUCED",
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

/**
 * 反映可否。
 * ブロックするのは「今回のChange Setが新規発生・悪化させた問題」だけ。
 * 変更前から存在する問題（WARNING）は理由にしない。
 */
export function canPublish(qa: QaResult | null): { allowed: boolean; reason: string } {
  if (!qa) return { allowed: false, reason: "QAが実行されていません" };
  const fails = qa.issues.filter((i) => i.verdict === "FAIL");
  if (fails.length > 0) {
    const sample = fails
      .slice(0, 3)
      .map((i) => `${i.category}(${i.origin}) ${i.target}`)
      .join(" / ");
    return {
      allowed: false,
      reason: `今回の変更が新規発生・悪化させた問題が${fails.length}件あります。本番反映はできません — ${sample}`,
    };
  }
  return { allowed: true, reason: "" };
}

export type { QaCategory };
