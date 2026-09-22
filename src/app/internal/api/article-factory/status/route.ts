/**
 * 新規記事ワークフローの状態取得。
 *
 * 2つのモードがある。
 *
 *   ?runId=... &mode=meta    — 実行状態のスナップショット（軽量）
 *   ?runId=... [&startIndex] — 進捗イベントをNDJSONでストリーミング
 *
 * ストリームは workflow/api の getReadable() をそのまま流すため、
 * ページをリロードしても startIndex=0 で最初から読み直せる。
 * これによりダッシュボードは再接続して現在のフェーズを復元できる。
 */

import { NextResponse, type NextRequest } from "next/server";
import { getRun } from "workflow/api";
import { isAuthorized } from "@/lib/seo-editor/auth";
import type { WorkflowEvent } from "@/lib/article-factory/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ ok: false, error: "runId が必要です" }, { status: 400 });
  }

  const run = getRun<unknown>(runId);

  if (!(await run.exists)) {
    return NextResponse.json(
      { ok: false, error: "指定されたrunIdの実行が見つかりません" },
      { status: 404 }
    );
  }

  // ── メタ情報のみ（ポーリング用の軽量モード） ──
  if (searchParams.get("mode") === "meta") {
    const [status, createdAt, completedAt] = await Promise.all([
      run.status,
      run.createdAt,
      run.completedAt,
    ]);
    return NextResponse.json({
      ok: true,
      runId,
      status,
      createdAt: createdAt?.toISOString() ?? null,
      completedAt: completedAt?.toISOString() ?? null,
    });
  }

  // ── 進捗イベントのストリーミング ──
  const startIndexRaw = searchParams.get("startIndex");
  const startIndex = startIndexRaw ? Number(startIndexRaw) : 0;

  const readable = run.getReadable<WorkflowEvent>({
    startIndex: Number.isFinite(startIndex) ? startIndex : 0,
  });

  // 進捗イベントを1行1JSON（NDJSON）に変換して返す
  const encoder = new TextEncoder();
  const ndjson = readable.pipeThrough(
    new TransformStream<WorkflowEvent, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
      },
    })
  );

  return new Response(ndjson, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
