/**
 * API課金ゼロ運用: 旧 Article Factory の有料LLMワークフロー起動を停止。
 *
 * 記事作成は通常のChatGPTで調査・執筆し、GitHub連携で専用PRに保存する。
 * このエンドポイントは旧ダッシュボードの操作や誤った自動実行で課金しないよう
 * 意図的に 410 を返す。既存PRや /status の参照は影響を受けない。
 */
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/seo-editor/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
    });
  }

  return NextResponse.json(
    {
      ok: false,
      code: "ARTICLE_FACTORY_CHATGPT_ONLY",
      error:
        "OpenAI APIを使用する旧記事生成は停止中です。通常のChatGPTの朝の候補通知で記事を選択してください。記事はChatGPTからGitHubのPRとして作成します。",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
