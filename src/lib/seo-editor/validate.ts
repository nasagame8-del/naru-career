/**
 * サーバー側のスキーマ検証。
 *
 * 署名検証（signature.ts）で改ざんは弾けるが、
 * 署名が通った Run であっても形が壊れていれば後続Phaseが誤作動するため、
 * 構造そのものをここで検証する。LLMのStructured Output検証にも使う。
 *
 * Zodは導入しない方針のため、必要最小限のバリデータを自前で持つ。
 */

import {
  SEO_PHASE_ORDER,
  type ActionDecision,
  type CannibalizationAudit,
  type ClusterAudit,
  type InternalLinkPlan,
  type QaResult,
  type SeoBrief,
  type SeoRun,
  type SeoTopicSelection,
} from "@/types/seo-editor";

export class ValidationError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ValidationError";
    this.path = path;
  }
}

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function req(v: unknown, path: string): Rec {
  if (!isRec(v)) throw new ValidationError(path, "オブジェクトではありません");
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string") throw new ValidationError(path, "文字列ではありません");
  return v;
}

function numv(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new ValidationError(path, "数値ではありません");
  return v;
}

function boolv(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") throw new ValidationError(path, "真偽値ではありません");
  return v;
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new ValidationError(path, "配列ではありません");
  return v;
}

function strList(v: unknown, path: string): string[] {
  return list(v, path).map((x, i) => str(x, `${path}[${i}]`));
}

function oneOf<T extends string>(v: unknown, values: readonly T[], path: string): T {
  const s = str(v, path);
  if (!(values as readonly string[]).includes(s))
    throw new ValidationError(path, `${values.join(" | ")} のいずれかである必要があります`);
  return s as T;
}

function nullableStr(v: unknown, path: string): string | null {
  if (v === null) return null;
  return str(v, path);
}

function nullableNum(v: unknown, path: string): number | null {
  if (v === null) return null;
  return numv(v, path);
}

const CONFIDENCE = ["low", "medium", "high"] as const;

// ── Phase 1 ──

export function validateTopicSelection(v: unknown, path = "selection"): SeoTopicSelection {
  const o = req(v, path);
  const candidates = list(o.candidates, `${path}.candidates`).map((c, i) => {
    const p = `${path}.candidates[${i}]`;
    const co = req(c, p);
    return {
      id: str(co.id, `${p}.id`),
      topic: str(co.topic, `${p}.topic`),
      type: oneOf(
        co.type,
        ["cluster_opportunity", "rewrite_opportunity", "cannibalization_risk", "ctr_opportunity", "new_demand"] as const,
        `${p}.type`
      ),
      reason: str(co.reason, `${p}.reason`),
      queries: list(co.queries, `${p}.queries`).map((q, j) => {
        const qp = `${p}.queries[${j}]`;
        const qo = req(q, qp);
        return {
          query: str(qo.query, `${qp}.query`),
          clicks: numv(qo.clicks, `${qp}.clicks`),
          impressions: numv(qo.impressions, `${qp}.impressions`),
          ctr: numv(qo.ctr, `${qp}.ctr`),
          position: numv(qo.position, `${qp}.position`),
          positionChange: nullableNum(qo.positionChange, `${qp}.positionChange`),
          impressionChange: nullableNum(qo.impressionChange, `${qp}.impressionChange`),
        };
      }),
      relatedPages: strList(co.relatedPages, `${p}.relatedPages`),
      possibleActions: list(co.possibleActions, `${p}.possibleActions`).map((a, j) =>
        oneOf(
          a,
          ["rewrite", "expand", "new_article", "internal_links", "merge", "title_meta"] as const,
          `${p}.possibleActions[${j}]`
        )
      ),
      evidence: strList(co.evidence, `${p}.evidence`),
      dataConfidence: oneOf(co.dataConfidence, CONFIDENCE, `${p}.dataConfidence`),
      caveats: strList(co.caveats, `${p}.caveats`),
    };
  });
  return {
    candidates,
    dataAssessment: str(o.dataAssessment, `${path}.dataAssessment`),
    lowDataWarning: boolv(o.lowDataWarning, `${path}.lowDataWarning`),
  };
}

// ── Phase 2 ──

export function validateCannibalization(v: unknown, path = "cannibalization"): CannibalizationAudit {
  const o = req(v, path);
  return {
    status: oneOf(
      o.status,
      ["NO_CONFLICT", "INTENT_OVERLAP", "STRONG_CANNIBALIZATION", "MERGE_CANDIDATE", "ROLE_CLARIFICATION_NEEDED"] as const,
      `${path}.status`
    ),
    pages: list(o.pages, `${path}.pages`).map((pg, i) => {
      const p = `${path}.pages[${i}]`;
      const po = req(pg, p);
      return {
        slug: str(po.slug, `${p}.slug`),
        url: str(po.url, `${p}.url`),
        title: str(po.title, `${p}.title`),
        searchIntent: str(po.searchIntent, `${p}.searchIntent`),
        targetReader: str(po.targetReader, `${p}.targetReader`),
        role: str(po.role, `${p}.role`),
        sharedQueries: strList(po.sharedQueries, `${p}.sharedQueries`),
      };
    }),
    reason: str(o.reason, `${path}.reason`),
    intentDifferences: strList(o.intentDifferences, `${path}.intentDifferences`),
    recommendedAction: str(o.recommendedAction, `${path}.recommendedAction`),
    confidence: oneOf(o.confidence, CONFIDENCE, `${path}.confidence`),
    inspectedSlugs: strList(o.inspectedSlugs ?? [], `${path}.inspectedSlugs`),
  };
}

// ── Phase 3 ──

export function validateClusterAudit(v: unknown, path = "clusterAudit"): ClusterAudit {
  const o = req(v, path);
  const pillar = req(o.pillar, `${path}.pillar`);
  return {
    pillar: {
      status: oneOf(pillar.status, ["existing", "candidate", "missing"] as const, `${path}.pillar.status`),
      url: nullableStr(pillar.url, `${path}.pillar.url`),
      title: str(pillar.title, `${path}.pillar.title`),
      reason: str(pillar.reason, `${path}.pillar.reason`),
    },
    nodes: list(o.nodes, `${path}.nodes`).map((nd, i) => {
      const p = `${path}.nodes[${i}]`;
      const no = req(nd, p);
      return {
        slug: str(no.slug, `${p}.slug`),
        url: str(no.url, `${p}.url`),
        title: str(no.title, `${p}.title`),
        role: oneOf(no.role, ["pillar", "cluster", "supporting"] as const, `${p}.role`),
        coverage: oneOf(no.coverage, ["full", "partial", "thin"] as const, `${p}.coverage`),
        note: str(no.note, `${p}.note`),
      };
    }),
    missingTopics: list(o.missingTopics, `${path}.missingTopics`).map((mt, i) => {
      const p = `${path}.missingTopics[${i}]`;
      const mo = req(mt, p);
      return {
        topic: str(mo.topic, `${p}.topic`),
        searchIntent: str(mo.searchIntent, `${p}.searchIntent`),
        canBeCoveredBy: nullableStr(mo.canBeCoveredBy, `${p}.canBeCoveredBy`),
        independentPageJustified: boolv(mo.independentPageJustified, `${p}.independentPageJustified`),
        reason: str(mo.reason, `${p}.reason`),
      };
    }),
    notes: strList(o.notes, `${path}.notes`),
    confidence: oneOf(o.confidence, CONFIDENCE, `${path}.confidence`),
  };
}

// ── Phase 4 ──

export function validateActionDecision(v: unknown, path = "actionDecision"): ActionDecision {
  const o = req(v, path);
  return {
    decisions: list(o.decisions, `${path}.decisions`).map((d, i) => {
      const p = `${path}.decisions[${i}]`;
      const dd = req(d, p);
      return {
        target: str(dd.target, `${p}.target`),
        targetType: oneOf(dd.targetType, ["article", "new_article", "guide"] as const, `${p}.targetType`),
        action: oneOf(dd.action, ["KEEP", "REWRITE", "EXPAND", "CREATE", "MERGE"] as const, `${p}.action`),
        reason: str(dd.reason, `${p}.reason`),
        evidence: strList(dd.evidence, `${p}.evidence`),
        risk: str(dd.risk, `${p}.risk`),
        mergeInto: nullableStr(dd.mergeInto, `${p}.mergeInto`),
        expandTopics: strList(dd.expandTopics, `${p}.expandTopics`),
      };
    }),
    summary: str(o.summary, `${path}.summary`),
    warnings: strList(o.warnings ?? [], `${path}.warnings`),
  };
}

// ── Phase 5 ──

function validateLink(v: unknown, path: string) {
  const o = req(v, path);
  return {
    source: str(o.source, `${path}.source`),
    target: str(o.target, `${path}.target`),
    placement: str(o.placement, `${path}.placement`),
    anchor: str(o.anchor, `${path}.anchor`),
    reason: str(o.reason, `${path}.reason`),
    operation: oneOf(o.operation, ["ADD", "UPDATE", "REMOVE"] as const, `${path}.operation`),
  };
}

export function validateLinkPlan(v: unknown, path = "internalLinks"): InternalLinkPlan {
  const o = req(v, path);
  return {
    links: list(o.links, `${path}.links`).map((l, i) => validateLink(l, `${path}.links[${i}]`)),
    notes: strList(o.notes, `${path}.notes`),
    rejected: list(o.rejected ?? [], `${path}.rejected`).map((r, i) => {
      const p = `${path}.rejected[${i}]`;
      const ro = req(r, p);
      return { link: validateLink(ro.link, `${p}.link`), reason: str(ro.reason, `${p}.reason`) };
    }),
  };
}

// ── Phase 6 ──

export function validateBrief(v: unknown, path = "brief"): SeoBrief {
  const o = req(v, path);
  return {
    target: str(o.target, `${path}.target`),
    action: oneOf(o.action, ["KEEP", "REWRITE", "EXPAND", "CREATE", "MERGE"] as const, `${path}.action`),
    primaryIntent: str(o.primaryIntent, `${path}.primaryIntent`),
    targetReader: str(o.targetReader, `${path}.targetReader`),
    roleInCluster: str(o.roleInCluster, `${path}.roleInCluster`),
    mustAnswer: strList(o.mustAnswer, `${path}.mustAnswer`),
    recommendedHeadings: strList(o.recommendedHeadings, `${path}.recommendedHeadings`),
    firstPartyEvidence: strList(o.firstPartyEvidence, `${path}.firstPartyEvidence`),
    internalLinksIn: list(o.internalLinksIn, `${path}.internalLinksIn`).map((l, i) =>
      validateLink(l, `${path}.internalLinksIn[${i}]`)
    ),
    internalLinksOut: list(o.internalLinksOut, `${path}.internalLinksOut`).map((l, i) =>
      validateLink(l, `${path}.internalLinksOut[${i}]`)
    ),
    preserve: strList(o.preserve, `${path}.preserve`),
    doNotInvent: strList(o.doNotInvent, `${path}.doNotInvent`),
    sources: list(o.sources ?? [], `${path}.sources`).map((s, i) => {
      const p = `${path}.sources[${i}]`;
      const so = req(s, p);
      return {
        url: str(so.url, `${p}.url`),
        title: str(so.title, `${p}.title`),
        retrievedAt: str(so.retrievedAt, `${p}.retrievedAt`),
        usedFor: str(so.usedFor, `${p}.usedFor`),
      };
    }),
  };
}

// ── Phase 7 / 8 ──

export function validateChange(v: unknown, path: string) {
  const o = req(v, path);
  return {
    path: str(o.path, `${path}.path`),
    operation: oneOf(o.operation, ["CREATE", "UPDATE", "DELETE"] as const, `${path}.operation`),
    before: nullableStr(o.before, `${path}.before`),
    after: str(o.after, `${path}.after`),
    reason: str(o.reason, `${path}.reason`),
    phase: oneOf(o.phase, SEO_PHASE_ORDER, `${path}.phase`),
    preservedSegments: strList(o.preservedSegments, `${path}.preservedSegments`),
    lostSegments: strList(o.lostSegments, `${path}.lostSegments`),
    needsHumanDecision: boolv(o.needsHumanDecision, `${path}.needsHumanDecision`),
    note: str(o.note, `${path}.note`),
  };
}

// ── Phase 9 ──

export function validateQaResult(v: unknown, path = "qa"): QaResult {
  const o = req(v, path);
  const VERDICTS = ["PASS", "NEEDS_REVIEW", "FAIL"] as const;
  const CATEGORIES = [
    "FACT",
    "EXPERIENCE",
    "SEARCH_INTENT",
    "CANNIBALIZATION",
    "INTERNAL_LINK",
    "BROKEN_LINK",
    "FRONTMATTER",
    "DUPLICATION",
  ] as const;
  const byCategoryRaw = isRec(o.byCategory) ? o.byCategory : {};
  const byCategory: QaResult["byCategory"] = {};
  for (const [k, val] of Object.entries(byCategoryRaw)) {
    if ((CATEGORIES as readonly string[]).includes(k)) {
      byCategory[k as (typeof CATEGORIES)[number]] = oneOf(val, VERDICTS, `${path}.byCategory.${k}`);
    }
  }
  return {
    overall: oneOf(o.overall, VERDICTS, `${path}.overall`),
    issues: list(o.issues, `${path}.issues`).map((it, i) => {
      const p = `${path}.issues[${i}]`;
      const io = req(it, p);
      const factCategory = io.factCategory;
      return {
        category: oneOf(io.category, CATEGORIES, `${p}.category`),
        verdict: oneOf(io.verdict, VERDICTS, `${p}.verdict`),
        target: str(io.target, `${p}.target`),
        location: str(io.location, `${p}.location`),
        message: str(io.message, `${p}.message`),
        evidence: str(io.evidence, `${p}.evidence`),
        ...(factCategory === undefined || factCategory === null
          ? {}
          : {
              factCategory: oneOf(
                factCategory,
                ["CONTRADICTION", "UNSUPPORTED", "AMBIGUOUS"] as const,
                `${p}.factCategory`
              ),
            }),
      };
    }),
    summary: str(o.summary, `${path}.summary`),
    byCategory,
  };
}

// ── SeoRun 全体 ──

/**
 * クライアントから返ってきた Run を全面的に検証する。
 * 署名検証を通過した後でも、必ずこれを通してから後続Phaseへ渡す。
 */
export function validateSeoRun(v: unknown): SeoRun {
  const o = req(v, "run");
  const STATUSES = ["idle", "running", "completed", "failed", "published"] as const;
  const STATES = ["pending", "running", "done", "failed", "skipped"] as const;

  const phases = list(o.phases, "run.phases").map((p, i) => {
    const path = `run.phases[${i}]`;
    const po = req(p, path);
    return {
      phase: oneOf(po.phase, SEO_PHASE_ORDER, `${path}.phase`),
      state: oneOf(po.state, STATES, `${path}.state`),
      ...(typeof po.startedAt === "string" ? { startedAt: po.startedAt } : {}),
      ...(typeof po.finishedAt === "string" ? { finishedAt: po.finishedAt } : {}),
      ...(typeof po.error === "string" ? { error: po.error } : {}),
      ...(Array.isArray(po.usage)
        ? {
            usage: po.usage.map((u, j) => {
              const up = `${path}.usage[${j}]`;
              const uo = req(u, up);
              return {
                model: str(uo.model, `${up}.model`),
                inputTokens: numv(uo.inputTokens, `${up}.inputTokens`),
                outputTokens: numv(uo.outputTokens, `${up}.outputTokens`),
                cachedInputTokens: numv(uo.cachedInputTokens, `${up}.cachedInputTokens`),
              };
            }),
          }
        : {}),
    };
  });

  if (phases.length !== SEO_PHASE_ORDER.length) {
    throw new ValidationError("run.phases", "Phase数が想定と一致しません");
  }

  const selection = o.selection === null ? null : validateTopicSelection(o.selection);
  const selectedTopic =
    o.selectedTopic === null
      ? null
      : validateTopicSelection({ candidates: [o.selectedTopic], dataAssessment: "", lowDataWarning: false })
          .candidates[0];

  return {
    id: str(o.id, "run.id"),
    createdAt: str(o.createdAt, "run.createdAt"),
    updatedAt: str(o.updatedAt, "run.updatedAt"),
    status: oneOf(o.status, STATUSES, "run.status"),
    currentPhase: oneOf(o.currentPhase, SEO_PHASE_ORDER, "run.currentPhase"),
    phases,
    selection,
    selectedTopic,
    cannibalization: o.cannibalization === null ? null : validateCannibalization(o.cannibalization),
    clusterAudit: o.clusterAudit === null ? null : validateClusterAudit(o.clusterAudit),
    actionDecision: o.actionDecision === null ? null : validateActionDecision(o.actionDecision),
    internalLinks: o.internalLinks === null ? null : validateLinkPlan(o.internalLinks),
    briefs: list(o.briefs, "run.briefs").map((b, i) => validateBrief(b, `run.briefs[${i}]`)),
    changes: list(o.changes, "run.changes").map((c, i) => validateChange(c, `run.changes[${i}]`)),
    qa: o.qa === null ? null : validateQaResult(o.qa),
    research: list(o.research, "run.research").map((s, i) => {
      const p = `run.research[${i}]`;
      const so = req(s, p);
      return {
        url: str(so.url, `${p}.url`),
        title: str(so.title, `${p}.title`),
        retrievedAt: str(so.retrievedAt, `${p}.retrievedAt`),
        usedFor: str(so.usedFor, `${p}.usedFor`),
      };
    }),
    publish:
      o.publish === null
        ? null
        : (() => {
            const p = req(o.publish, "run.publish");
            return {
              branch: str(p.branch, "run.publish.branch"),
              commitSha: str(p.commitSha, "run.publish.commitSha"),
              prNumber: numv(p.prNumber, "run.publish.prNumber"),
              prUrl: str(p.prUrl, "run.publish.prUrl"),
              baseBranch: str(p.baseBranch, "run.publish.baseBranch"),
              createdAt: str(p.createdAt, "run.publish.createdAt"),
              previewNote: nullableStr(p.previewNote, "run.publish.previewNote"),
            };
          })(),
    usage: list(o.usage, "run.usage").map((u, i) => {
      const p = `run.usage[${i}]`;
      const uo = req(u, p);
      return {
        model: str(uo.model, `${p}.model`),
        inputTokens: numv(uo.inputTokens, `${p}.inputTokens`),
        outputTokens: numv(uo.outputTokens, `${p}.outputTokens`),
        cachedInputTokens: numv(uo.cachedInputTokens, `${p}.cachedInputTokens`),
      };
    }),
    warnings: strList(o.warnings, "run.warnings"),
  };
}
