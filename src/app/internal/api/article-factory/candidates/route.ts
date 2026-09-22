/**
 * 新規記事の候補 API（管理ダッシュボード用）。
 *
 * GET  — 保存済みの最新バッチを返す
 * POST — 候補を手動生成して保存する
 *
 * ガード:
 *   - /internal/* の Basic 認証（src/middleware.ts）に加え、ルート側でも再検証する
 *   - 本番で永続保存を用意できない場合は 503 で明示的に失敗する（メモリへ落ちない）
 *   - secret は一切レスポンスに含めない
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/seo-editor/auth";
import { generateCandidateBatch, batchMeetsQuota } from "@/lib/article-factory/candidates";
import {
  describeStore,
  getCandidateBatchStore,
  StorageUnavailableError,
  type CandidateBatchStore,
} from "@/lib/article-factory/storage";
import { SeoEditorError } from "@/lib/seo-editor/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
  });
}

/** 保存先の解決。失敗時は 503 レスポンスを返す */
function resolveStore(): { store: CandidateBatchStore } | { response: NextResponse } {
  try {
    return { store: getCandidateBatchStore() };
  } catch (e) {
    if (e instanceof StorageUnavailableError) {
      return {
        response: NextResponse.json(
          {
            ok: false,
            error: `候補バッチの保存先を用意できません — ${e.message}`,
            reasons: e.reasons,
            storage: { kind: "unavailable", durable: false, warning: e.message },
          },
          { status: 503 }
        ),
      };
    }
    throw e;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  const resolved = resolveStore();
  if ("response" in resolved) return resolved.response;
  const { store } = resolved;

  try {
    const batch = await store.getLatest();
    return NextResponse.json({
      ok: true,
      batch,
      storage: describeStore(store),
      meetsQuota: batch ? batchMeetsQuota(batch) : false,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 300) : "候補バッチを取得できませんでした",
        storage: describeStore(store),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  const resolved = resolveStore();
  if ("response" in resolved) return resolved.response;
  const { store } = resolved;

  try {
    const batch = await generateCandidateBatch({ trigger: "manual" });
    await store.save(batch);
    return NextResponse.json({
      ok: true,
      batch,
      storage: describeStore(store),
      meetsQuota: batchMeetsQuota(batch),
    });
  } catch (e) {
    const message =
      e instanceof SeoEditorError
        ? e.message
        : e instanceof Error
          ? e.message.slice(0, 300)
          : "候補生成に失敗しました";
    return NextResponse.json(
      { ok: false, error: message, storage: describeStore(store) },
      { status: 500 }
    );
  }
}
