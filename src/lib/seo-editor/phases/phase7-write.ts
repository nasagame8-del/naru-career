/**
 * PHASE 7 — 新規記事生成 / リライト
 *
 * ArticleChange を作るだけで、ファイルには一切書き込まない。
 * 反映経路は Change Set → QA → GitHub Branch → Pull Request の一本だけ。
 */

import { runStructured } from "../openai";
import { WRITE_SCHEMA } from "../schemas/write";
import { WRITE_PROMPT } from "../prompts/write";
import { ValidationError } from "../validate";
import { getCorpusEolSample, getExperienceNotes, getPersona, getRawArticle } from "../corpus";
import { LIMITS } from "../config";
import { asJsonBlock, truncate, wrapUntrusted } from "../sanitize";
import {
  detectEol,
  findInventedPlaceholders,
  findDroppedPlaceholders,
  findLostSegments,
  insertAfterSection,
  listH2,
  mergeFrontmatter,
  parseArticle,
  rebuildArticle,
  todayJst,
  type EditableFrontmatter,
} from "../markdown";
import { topicBlock } from "./shared";
import type { ArticleChange, SeoBrief, SeoRun, SeoUsage } from "@/types/seo-editor";

export interface WritePhaseResult {
  changes: ArticleChange[];
  usage: SeoUsage[];
  warnings: string[];
}

interface WriteOutput {
  operation: "CREATE" | "REWRITE" | "EXPAND" | "MERGE";
  slug: string;
  frontmatter: EditableFrontmatter;
  markdownBody: string;
  insertions: { afterHeading: string; markdown: string }[];
  preservedSegments: string[];
  changeNotes: string[];
  mergeSecondarySlug: string | null;
}

function articlePath(slug: string): string {
  return `content/articles/${slug}.md`;
}

/**
 * 既存記事の更新で書き換えを許すキーだけを抜き出す。
 * ここに載らないキー（inlineFaq / widgets / cta_agents / naruPoint 等）は
 * 原文テキストのまま保持される。
 */
function editableUpdates(fm: EditableFrontmatter): Record<string, unknown> {
  const updates: Record<string, unknown> = { dateModified: todayJst() };
  if (fm.title) updates.title = fm.title;
  if (fm.category) updates.category = fm.category;
  if (fm.keyword) updates.keyword = fm.keyword;
  if (fm.excerpt) updates.excerpt = fm.excerpt;
  if (fm.summary.length > 0) updates.summary = fm.summary;
  if (fm.faq.length > 0) updates.faq = fm.faq;
  return updates;
}

export async function runWritePhase(run: SeoRun, brief: SeoBrief): Promise<WritePhaseResult> {
  const warnings: string[] = [];
  const topic = run.selectedTopic;
  if (!topic) throw new Error("テーマが選択されていません");

  const decision = run.actionDecision?.decisions.find((d) => d.target === brief.target);
  const action = brief.action;
  const slug = brief.target;
  const existingRaw = action === "CREATE" ? null : getRawArticle(slug);

  if (action !== "CREATE" && !existingRaw) {
    return {
      changes: [],
      usage: [],
      warnings: [`${slug}: 既存記事が見つからないため、この対象をスキップしました`],
    };
  }

  const mergeSecondary =
    action === "MERGE" && decision?.mergeInto && decision.mergeInto !== slug
      ? decision.mergeInto
      : null;
  const mergeSecondaryRaw = mergeSecondary ? getRawArticle(mergeSecondary) : null;

  const input = [
    "# タスク",
    "",
    `SEO Briefに従って、対象「${slug}」を ${action} してください。`,
    "",
    "## SEO Brief（この仕様に従うこと）",
    asJsonBlock("untrusted_seo_brief", brief),
    "",
    "## 選択されたテーマ",
    topicBlock(topic),
    "",
    "## 文体・ペルソナ",
    wrapUntrusted("untrusted_persona", getPersona()),
    "",
    "## 実話データ（本人情報の正本。ここに無い一次体験を作らない）",
    wrapUntrusted("untrusted_experience_notes", getExperienceNotes()),
    "",
    action === "CREATE" ? "## 既存本文" : "## 対象記事の現在の全文",
    existingRaw
      ? wrapUntrusted("untrusted_article_body", truncate(existingRaw, LIMITS.maxBodyChars * 2))
      : "（新規作成のため既存本文はありません）",
    "",
    mergeSecondaryRaw ? "## 統合元記事の全文" : "",
    mergeSecondaryRaw
      ? wrapUntrusted(
          "untrusted_merge_source_body",
          truncate(mergeSecondaryRaw, LIMITS.maxBodyChars * 2)
        )
      : "",
    "",
    existingRaw ? "## 実在するH2見出し（EXPANDのafterHeadingはここから選ぶ）" : "",
    existingRaw ? asJsonBlock("untrusted_headings", listH2(parseArticle(existingRaw).content)) : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { data: raw, usage } = await runStructured({
    name: "seo_article_write",
    instructions: WRITE_PROMPT,
    input,
    schema: WRITE_SCHEMA,
  });

  const out = raw as WriteOutput;
  if (!out || typeof out.markdownBody !== "string" || !Array.isArray(out.insertions)) {
    throw new ValidationError("write", "記事生成の出力形式が不正です");
  }

  const existing = existingRaw ? parseArticle(existingRaw) : null;
  let newBody: string;

  if (action === "EXPAND") {
    if (!existing) throw new ValidationError("write", "EXPAND対象の既存本文がありません");
    if (out.insertions.length === 0) {
      return {
        changes: [],
        usage: [usage],
        warnings: [`${slug}: 追加セクションが返されなかったため変更なしとしました`],
      };
    }
    let body = existing.content;
    for (const ins of out.insertions) {
      const next = insertAfterSection(body, ins.afterHeading, ins.markdown);
      if (next === null) {
        warnings.push(
          `${slug}: 見出し「${ins.afterHeading}」が見つからないため、このセクションの追加を見送りました`
        );
        continue;
      }
      body = next;
    }
    if (body === existing.content) {
      return {
        changes: [],
        usage: [usage],
        warnings: [...warnings, `${slug}: 挿入位置が特定できず、変更はありません`],
      };
    }
    newBody = body;
  } else {
    if (!out.markdownBody.trim()) {
      throw new ValidationError("write", `${slug}: 本文が空です`);
    }
    newBody = out.markdownBody;
  }

  // 既存記事はCRLF。改行コードを変えると全行が変更扱いになりPRが読めなくなる
  const eol = detectEol(existingRaw ?? getCorpusEolSample());

  // 既存記事では frontmatter を再serializeせず、値が実際に変わるキーだけを置換する
  const frontmatterUpdates =
    action === "CREATE"
      ? mergeFrontmatter(null, out.frontmatter, { isNew: true })
      : editableUpdates(out.frontmatter);

  const { text: after, frontmatterChangedKeys } = rebuildArticle({
    originalRaw: existingRaw,
    frontmatterUpdates,
    body: newBody,
    fallbackEol: eol,
  });

  // ── 機械的な安全検証 ──
  const beforeBody = existing?.content ?? null;

  const lostSegments = findLostSegments(newBody, out.preservedSegments);
  if (lostSegments.length > 0) {
    warnings.push(
      `${slug}: 保持を宣言した一次体験${lostSegments.length}件が本文に見つかりません（QAで確認してください）`
    );
  }

  const invented = findInventedPlaceholders(beforeBody, newBody);
  if (invented.length > 0) {
    warnings.push(`${slug}: 原文に無い特殊記法が追加されています — ${invented.join(", ")}`);
  }
  const dropped = findDroppedPlaceholders(beforeBody, newBody);
  if (dropped.length > 0) {
    warnings.push(`${slug}: 原文にあった特殊記法が失われています — ${dropped.join(", ")}`);
  }

  if (beforeBody && action === "REWRITE") {
    const shrink = 1 - newBody.length / beforeBody.length;
    if (shrink > 0.4) {
      warnings.push(
        `${slug}: リライトで本文が${Math.round(shrink * 100)}%縮小しています。一次体験の消失を確認してください`
      );
    }
  }

  const changes: ArticleChange[] = [
    {
      path: articlePath(slug),
      operation: action === "CREATE" ? "CREATE" : "UPDATE",
      before: existingRaw,
      after,
      reason: decision?.reason ?? brief.primaryIntent,
      phase: "write",
      preservedSegments: out.preservedSegments,
      lostSegments,
      needsHumanDecision: lostSegments.length > 0 || invented.length > 0 || dropped.length > 0,
      note: [
        out.changeNotes.join(" / "),
        frontmatterChangedKeys.length > 0
          ? `frontmatter変更: ${frontmatterChangedKeys.join(", ")}`
          : "frontmatter変更なし",
      ]
        .filter(Boolean)
        .join(" / "),
    },
  ];

  // MERGE: 統合元は自動削除せず、人間の判断が必要な項目として残す
  if (action === "MERGE" && mergeSecondary) {
    warnings.push(
      `${slug}: 統合元「${mergeSecondary}」の削除・リダイレクトは自動実行しません。人間の判断が必要です`
    );
    changes[0] = {
      ...changes[0],
      needsHumanDecision: true,
      note: [
        changes[0].note,
        `統合元 ${mergeSecondary} は残したままです。削除・301リダイレクト・canonicalの判断は人間が行ってください`,
      ]
        .filter(Boolean)
        .join(" / "),
    };
  }

  return { changes, usage: [usage], warnings };
}
