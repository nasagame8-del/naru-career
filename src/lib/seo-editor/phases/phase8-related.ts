/**
 * PHASE 8 — 関連記事への内部リンク実装
 *
 * Phase 7 で生成・改稿した記事以外の、既存関連記事側にリンクを入れる。
 * リンク挿入以外の変更が混入していないかをコード側で検査する。
 */

import { runStructured } from "../openai";
import { RELATED_SCHEMA } from "../schemas/related";
import { RELATED_PROMPT } from "../prompts/related";
import { ValidationError } from "../validate";
import { getRawArticle } from "../corpus";
import { LIMITS } from "../config";
import { asJsonBlock, truncate, wrapUntrusted } from "../sanitize";
import {
  findDroppedPlaceholders,
  findInventedPlaceholders,
  listH2,
  parseArticle,
  rebuildArticle,
} from "../markdown";
import type { ArticleChange, InternalLink, SeoRun, SeoUsage } from "@/types/seo-editor";

export interface RelatedPhaseResult {
  change: ArticleChange | null;
  usage: SeoUsage[];
  warnings: string[];
}

export interface RelatedTarget {
  slug: string;
  links: InternalLink[];
}

/**
 * Phase 8 の対象 = 内部リンク計画の source のうち、
 * Phase 7 で既に書き換えた記事を除いたもの。
 */
export function relatedTargets(run: SeoRun): RelatedTarget[] {
  const alreadyWritten = new Set(
    run.changes.filter((c) => c.phase === "write").map((c) => c.path)
  );
  const bySlug = new Map<string, InternalLink[]>();

  for (const link of run.internalLinks?.links ?? []) {
    const m = link.source.match(/^\/articles\/([\w-]+)$/);
    if (!m) continue;
    const slug = m[1];
    if (alreadyWritten.has(`content/articles/${slug}.md`)) continue;
    if (!getRawArticle(slug)) continue;
    const list = bySlug.get(slug) ?? [];
    list.push(link);
    bySlug.set(slug, list);
  }

  return [...bySlug.entries()].map(([slug, links]) => ({ slug, links }));
}

interface RelatedOutput {
  slug: string;
  markdownBody: string;
  appliedLinks: { target: string; anchor: string; insertedNear: string }[];
  skippedLinks: string[];
  changeNotes: string[];
}

export async function runRelatedPhase(
  run: SeoRun,
  target: RelatedTarget
): Promise<RelatedPhaseResult> {
  const warnings: string[] = [];
  const raw = getRawArticle(target.slug);
  if (!raw) {
    return { change: null, usage: [], warnings: [`${target.slug}: 本文を読み込めませんでした`] };
  }

  const existing = parseArticle(raw);
  const headings = listH2(existing.content);

  const input = [
    "# タスク",
    "",
    `記事「${target.slug}」に、計画された内部リンクを差し込んでください。`,
    "リンクの挿入・修正・削除以外の変更をしてはいけません。",
    "",
    "## 挿入する内部リンク",
    asJsonBlock("untrusted_link_plan", target.links),
    "",
    "## この記事の実在するH2見出し",
    asJsonBlock("untrusted_headings", headings),
    "",
    "## 記事の現在の本文（frontmatterを除く）",
    wrapUntrusted("untrusted_article_body", truncate(existing.content, LIMITS.maxBodyChars * 2)),
  ].join("\n");

  const { data: parsed, usage } = await runStructured({
    name: "seo_related_links",
    instructions: RELATED_PROMPT,
    input,
    schema: RELATED_SCHEMA,
  });

  const out = parsed as RelatedOutput;
  if (!out || typeof out.markdownBody !== "string") {
    throw new ValidationError("related", `${target.slug}: 出力形式が不正です`);
  }

  const newBody = out.markdownBody;

  if (newBody.trim() === existing.content.trim()) {
    return {
      change: null,
      usage: [usage],
      warnings: [
        `${target.slug}: 内部リンクは挿入されませんでした${out.skippedLinks.length > 0 ? ` — ${out.skippedLinks.join(" / ")}` : ""}`,
      ],
    };
  }

  // ── リンク挿入以外の変更が混入していないか検査 ──
  const newHeadings = listH2(newBody);
  if (newHeadings.length !== headings.length || newHeadings.some((h, i) => h !== headings[i])) {
    return {
      change: null,
      usage: [usage],
      warnings: [
        `${target.slug}: H2見出しが変更されていたため、この記事への内部リンク追加を破棄しました`,
      ],
    };
  }

  const invented = findInventedPlaceholders(existing.content, newBody);
  const dropped = findDroppedPlaceholders(existing.content, newBody);
  if (invented.length > 0 || dropped.length > 0) {
    return {
      change: null,
      usage: [usage],
      warnings: [
        `${target.slug}: 特殊記法が変更されていたため、この記事への内部リンク追加を破棄しました`,
      ],
    };
  }

  // 本文量の変化が大きすぎる場合はリライトが混入している
  const delta = Math.abs(newBody.length - existing.content.length);
  const allowed = Math.max(600, existing.content.length * 0.08);
  if (delta > allowed) {
    return {
      change: null,
      usage: [usage],
      warnings: [
        `${target.slug}: 本文が${delta}文字変化しており、リンク挿入の範囲を超えるため破棄しました`,
      ],
    };
  }

  // 計画外のリンク先が増えていないか
  const plannedTargets = new Set(target.links.map((l) => l.target));
  const before = new Set([...existing.content.matchAll(/\]\((\/[^)\s]+)\)/g)].map((m) => m[1]));
  const afterLinks = [...newBody.matchAll(/\]\((\/[^)\s]+)\)/g)].map((m) => m[1]);
  const unplanned = afterLinks.filter((href) => !before.has(href) && !plannedTargets.has(href));
  if (unplanned.length > 0) {
    return {
      change: null,
      usage: [usage],
      warnings: [
        `${target.slug}: 計画外のリンク（${[...new Set(unplanned)].join(", ")}）が追加されたため破棄しました`,
      ],
    };
  }

  if (out.skippedLinks.length > 0) {
    warnings.push(`${target.slug}: 挿入を見送ったリンク — ${out.skippedLinks.join(" / ")}`);
  }

  // このPhaseは本文へのリンク挿入だけなので、frontmatterは1バイトも触らない
  const { text: after, frontmatterChangedKeys } = rebuildArticle({
    originalRaw: raw,
    frontmatterUpdates: {},
    body: newBody,
  });
  if (frontmatterChangedKeys.length > 0) {
    warnings.push(
      `${target.slug}: 想定外にfrontmatterが変更されました（${frontmatterChangedKeys.join(", ")}）`
    );
  }

  const change: ArticleChange = {
    path: `content/articles/${target.slug}.md`,
    operation: "UPDATE",
    before: raw,
    after,
    reason: `内部リンク計画に基づく関連記事の更新（${out.appliedLinks.length}件）`,
    phase: "related",
    preservedSegments: [],
    lostSegments: [],
    needsHumanDecision: false,
    note: out.changeNotes.join(" / "),
  };

  return { change, usage: [usage], warnings };
}
