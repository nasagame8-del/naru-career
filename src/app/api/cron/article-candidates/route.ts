/**
 * API課金ゼロ運用: 旧Vercel CronのLLM候補生成を停止する。
 * vercel.jsonから呼び出しスケジュールも削除するが、
 * 旧スケジュールや手動HTTPアクセスが残った場合もOpenAI APIを呼ばない。
 */
import { NextResponse, type NextRequest } from "next/server";
import { isValidCronAuth } from "@/lib/article-factory/safety";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isValidCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json(
    {
      ok: false,
      code: "ARTICLE_FACTORY_CHATGPT_ONLY",
      error: "有料APIによる候補生成は停止しました。候補はChatGPTの毎朝の定期タスクで作成します。",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
