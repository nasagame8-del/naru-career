/**
 * 新規記事ワークフローの起動。
 *
 * 選択された候補から耐久実行（Vercel Workflow）を開始し、
 * **runId を即座に返す**。以降の進捗は /status で再接続して取得する。
 * ブラウザを閉じても実行は継続する。
 *
 * ガード:
 *   - Basic 認証
 *   - 候補は保存済みバッチから取り直す（クライアントの申告を信用しない）
 *   - blocked な候補は起動しない
 */

import { NextResponse, type NextRequest } from "next/server";
import { start } from "workflow/api";
import { isAuthorized } from "@/lib/seo-editor/auth";
import { newArticleWorkflow } from "@/lib/article-factory/workflow";
import { getCandidateBatchStore } from "@/lib/article-factory/storage";
import { readInventory } from "@/lib/article-factory/inventory";
import { validateCandidate } from "@/lib/article-factory/safety";
import type { SelectedTopic } from "@/lib/article-factory/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  let body: { batchId?: string; candidateId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { batchId, candidateId } = body;
  if (!batchId || !candidateId) {
    return NextResponse.json(
      { ok: false, error: "batchId と candidateId が必要です" },
      { status: 400 }
    );
  }

  // クライアントから送られた候補内容は使わない。保存済みバッチを正本とする。
  const store = getCandidateBatchStore();
  const batch = await store.getById(batchId);
  if (!batch) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "指定されたバッチが見つかりません。候補を再生成してください（インメモリ保存の場合、インスタンス入れ替えで失われます）",
      },
      { status: 404 }
    );
  }

  const candidate = batch.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    return NextResponse.json(
      { ok: false, error: "指定された候補が見つかりません" },
      { status: 404 }
    );
  }

  // 起動直前にもう一度、最新の在庫で機械判定し直す
  const inventory = readInventory();
  const revalidated = validateCandidate(candidate, inventory.existing);
  if (revalidated.blocked) {
    return NextResponse.json(
      {
        ok: false,
        error: `この候補は実行できません — ${revalidated.blockedReasons.join(" / ")}`,
        blockedReasons: revalidated.blockedReasons,
      },
      { status: 409 }
    );
  }

  const topic: SelectedTopic = {
    batchId: batch.batchId,
    candidateId: candidate.id,
    title: candidate.title,
    primaryKeyword: candidate.primaryKeyword,
    secondaryKeywords: candidate.secondaryKeywords,
    searchIntent: candidate.searchIntent,
    category: candidate.category,
    slug: candidate.proposedSlug,
    differenceFromExisting: candidate.differenceFromExisting,
    reasonToWriteNow: candidate.reasonToWriteNow,
    articleId: inventory.nextArticleId,
    selectedAt: new Date().toISOString(),
  };

  try {
    // start() は即座に戻る。実行はサーバー側で継続するため、
    // ブラウザを閉じてもワークフローは止まらない。
    // runId はワークフロー内で getWorkflowMetadata() から取得され、
    // PRのbranch名にも使われる（同一runIdなら冪等）。
    const run = await start(newArticleWorkflow, [topic]);

    return NextResponse.json({ ok: true, runId: run.runId, topic });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 300) : "ワークフローを開始できませんでした",
      },
      { status: 500 }
    );
  }
}
