/**
 * API課金ゼロ運用: 候補一覧のGETは継続し、有料LLMを呼ぶPOSTのみ停止。
 * 新しい候補バッチは通常のChatGPTからGitHubの
 * article-factory/candidates 専用ブランチへ保存する。
 */
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/seo-editor/auth";
import { LIMITS } from "@/lib/article-factory/constants";
import {
  describeStore,
  getCandidateBatchStore,
  StorageUnavailableError,
  type CandidateBatchStore,
} from "@/lib/article-factory/storage";

export const dynamic = "force-dynamic";

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
  });
}

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
    return NextResponse.json(
      {
        ok: true,
        batch,
        storage: describeStore(store),
        meetsQuota: batch
          ? batch.candidates.filter((candidate) => !candidate.blocked).length >= LIMITS.minCandidates
          : false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 300) : "候補を取得できませんでした",
        storage: describeStore(store),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  return NextResponse.json(
    {
      ok: false,
      code: "ARTICLE_FACTORY_CHATGPT_ONLY",
      error:
        "OpenAI APIを使用する候補生成は停止中です。毎朝のChatGPT通知から候補を選択してください。候補一覧はこの画面で引き続き確認できます。",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
