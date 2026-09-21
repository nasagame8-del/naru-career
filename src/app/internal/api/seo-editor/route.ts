/**
 * SEO Editor API — Phase実行のディスパッチャ。
 *
 * 設計:
 *   - 1リクエスト = 1 Phase（= 原則1 LLM呼び出し）。長時間実行を避け、
 *     失敗したPhaseから再開できるようにする。
 *   - Search Consoleデータはサーバー側で取得する。クライアントからは受け取らない。
 *   - Runはサーバーが署名して返す。次のリクエストで署名とスキーマの両方を検証し、
 *     改ざんされたPhase結果が記事生成やPR作成へ進まないようにする。
 *   - OPENAI_API_KEY / GitHub Token 等のsecretは一切レスポンスに含めない。
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/seo-editor/auth";
import { signRun, verifySignedRun, RunSignatureError } from "@/lib/seo-editor/signature";
import { validateSeoRun, ValidationError } from "@/lib/seo-editor/validate";
import { SeoEditorError } from "@/lib/seo-editor/openai";
import {
  addWarnings,
  assertPhaseReady,
  createRun,
  markPhaseDone,
  markPhaseFailed,
  markPhaseRunning,
} from "@/lib/seo-editor/run";
import { runTopicsPhase } from "@/lib/seo-editor/phases/phase1-topics";
import { runCannibalizationPhase } from "@/lib/seo-editor/phases/phase2-cannibalization";
import { runClusterPhase } from "@/lib/seo-editor/phases/phase3-cluster";
import { runActionPhase } from "@/lib/seo-editor/phases/phase4-action";
import { runLinksPhase } from "@/lib/seo-editor/phases/phase5-links";
import { runBriefPhase, briefTargets } from "@/lib/seo-editor/phases/phase6-brief";
import { runWritePhase } from "@/lib/seo-editor/phases/phase7-write";
import { runRelatedPhase, relatedTargets } from "@/lib/seo-editor/phases/phase8-related";
import { runQaPhase } from "@/lib/seo-editor/phases/phase9-qa";
import { SEO_PHASE_ORDER, type SeoPhaseId, type SeoRun } from "@/types/seo-editor";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
  });
}

function fail(run: SeoRun | null, phase: SeoPhaseId | null, message: string, status = 400) {
  const base = run ?? createRun();
  const failed = phase ? markPhaseFailed(base, phase, message) : { ...base, status: "failed" as const };
  return NextResponse.json(
    { ok: false, signedRun: signRun(failed), error: message, failedPhase: phase ?? undefined },
    { status }
  );
}

function isPhaseId(value: unknown): value is SeoPhaseId {
  return typeof value === "string" && (SEO_PHASE_ORDER as string[]).includes(value);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail(null, null, "リクエストボディが不正です");
  }

  const action = body.action;
  if (!isPhaseId(action)) {
    return fail(null, null, `未知のaction: ${String(action)}`);
  }

  // ── Runの復元（Phase 1以外は必須） ──
  let run: SeoRun;
  if (action === "topics") {
    run = createRun();
  } else {
    try {
      const verified = verifySignedRun(body.signedRun);
      run = validateSeoRun(verified);
    } catch (e) {
      if (e instanceof RunSignatureError) return fail(null, action, e.message, 403);
      if (e instanceof ValidationError) {
        return fail(null, action, `Runの形式が不正です — ${e.message}`, 400);
      }
      return fail(null, action, "Runを復元できませんでした", 400);
    }

    const notReady = assertPhaseReady(run, action);
    if (notReady) return fail(run, action, notReady);
  }

  run = markPhaseRunning(run, action);
  const index = typeof body.index === "number" && body.index >= 0 ? Math.floor(body.index) : 0;

  try {
    switch (action) {
      // ── PHASE 1 ──
      case "topics": {
        const refresh = body.refreshGsc === true;
        const { selection, usage, warnings, gscFromCache } = await runTopicsPhase(refresh);
        run = addWarnings({ ...run, selection }, warnings);
        run = markPhaseDone(run, "topics", usage);
        // テーマ選択は人間が行うため、ここでは status を idle に戻す
        run = { ...run, status: "idle" };
        return NextResponse.json({ ok: true, signedRun: signRun(run), gscFromCache });
      }

      // ── PHASE 2 ──
      case "cannibalization": {
        const topicId = typeof body.topicId === "string" ? body.topicId : "";
        const candidate = run.selection?.candidates.find((c) => c.id === topicId) ?? null;
        if (!candidate) {
          return fail(run, action, "選択されたテーマが候補一覧に存在しません");
        }
        run = { ...run, selectedTopic: candidate };
        const { audit, usage, warnings } = await runCannibalizationPhase(candidate);
        run = addWarnings({ ...run, cannibalization: audit }, warnings);
        run = markPhaseDone(run, action, usage);
        break;
      }

      // ── PHASE 3 ──
      case "cluster": {
        if (!run.selectedTopic) return fail(run, action, "テーマが選択されていません");
        const { audit, usage, warnings } = await runClusterPhase(
          run.selectedTopic,
          run.cannibalization
        );
        run = addWarnings({ ...run, clusterAudit: audit }, warnings);
        run = markPhaseDone(run, action, usage);
        break;
      }

      // ── PHASE 4 ──
      case "action": {
        if (!run.selectedTopic) return fail(run, action, "テーマが選択されていません");
        const { decision, usage, warnings } = await runActionPhase(
          run.selectedTopic,
          run.cannibalization,
          run.clusterAudit
        );
        run = addWarnings({ ...run, actionDecision: decision }, warnings);
        run = markPhaseDone(run, action, usage);
        break;
      }

      // ── PHASE 5 ──
      case "links": {
        if (!run.selectedTopic) return fail(run, action, "テーマが選択されていません");
        const { plan, usage, warnings } = await runLinksPhase(
          run.selectedTopic,
          run.actionDecision,
          run.clusterAudit
        );
        run = addWarnings({ ...run, internalLinks: plan }, warnings);
        run = markPhaseDone(run, action, usage);
        break;
      }

      // ── PHASE 6（対象を1件ずつ） ──
      case "brief": {
        const targets = briefTargets(run);
        if (targets.length === 0) {
          run = markPhaseDone(run, action, []);
          run = addWarnings(run, ["変更対象が無いため、SEO Briefは作成されませんでした"]);
          break;
        }
        if (index >= targets.length) return fail(run, action, "対象インデックスが範囲外です");
        const { brief, usage, warnings } = await runBriefPhase(run, targets[index]);
        const briefs = [...run.briefs.filter((b) => b.target !== brief.target), brief];
        run = addWarnings({ ...run, briefs }, warnings);
        const hasMore = index + 1 < targets.length;
        if (!hasMore) run = markPhaseDone(run, action, usage);
        else run = { ...run, updatedAt: new Date().toISOString(), usage: [...run.usage, ...usage] };
        return NextResponse.json({
          ok: true,
          signedRun: signRun(run),
          hasMore,
          nextIndex: hasMore ? index + 1 : undefined,
        });
      }

      // ── PHASE 7（対象を1件ずつ） ──
      case "write": {
        const targets = run.briefs;
        if (targets.length === 0) {
          run = markPhaseDone(run, action, []);
          run = addWarnings(run, ["SEO Briefが無いため、記事生成は行われませんでした"]);
          break;
        }
        if (index >= targets.length) return fail(run, action, "対象インデックスが範囲外です");
        const { changes, usage, warnings } = await runWritePhase(run, targets[index]);
        const paths = new Set(changes.map((c) => c.path));
        const merged = [...run.changes.filter((c) => !paths.has(c.path)), ...changes];
        run = addWarnings({ ...run, changes: merged }, warnings);
        const hasMore = index + 1 < targets.length;
        if (!hasMore) run = markPhaseDone(run, action, usage);
        else run = { ...run, updatedAt: new Date().toISOString(), usage: [...run.usage, ...usage] };
        return NextResponse.json({
          ok: true,
          signedRun: signRun(run),
          hasMore,
          nextIndex: hasMore ? index + 1 : undefined,
        });
      }

      // ── PHASE 8（対象を1件ずつ） ──
      case "related": {
        const targets = relatedTargets(run);
        if (targets.length === 0) {
          run = markPhaseDone(run, action, []);
          run = addWarnings(run, ["関連記事への内部リンク追加対象はありませんでした"]);
          break;
        }
        if (index >= targets.length) return fail(run, action, "対象インデックスが範囲外です");
        const { change, usage, warnings } = await runRelatedPhase(run, targets[index]);
        const merged = change
          ? [...run.changes.filter((c) => c.path !== change.path), change]
          : run.changes;
        run = addWarnings({ ...run, changes: merged }, warnings);
        const hasMore = index + 1 < targets.length;
        if (!hasMore) run = markPhaseDone(run, action, usage);
        else run = { ...run, updatedAt: new Date().toISOString(), usage: [...run.usage, ...usage] };
        return NextResponse.json({
          ok: true,
          signedRun: signRun(run),
          hasMore,
          nextIndex: hasMore ? index + 1 : undefined,
        });
      }

      // ── PHASE 9 ──
      case "qa": {
        const { qa, usage, warnings } = await runQaPhase(run);
        run = addWarnings({ ...run, qa }, warnings);
        run = markPhaseDone(run, action, usage);
        break;
      }
    }

    return NextResponse.json({ ok: true, signedRun: signRun(run) });
  } catch (e) {
    const message =
      e instanceof SeoEditorError
        ? e.message
        : e instanceof ValidationError
          ? `AIの出力が想定の形式ではありません — ${e.message}`
          : e instanceof Error
            ? e.message.slice(0, 300)
            : "不明なエラー";
    return fail(run, action, message, 500);
  }
}
