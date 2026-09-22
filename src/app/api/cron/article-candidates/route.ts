/**
 * 毎日の新規記事候補生成（Vercel Cron）。
 *
 * スケジュール: vercel.json に `0 23 * * *`（UTC）= 08:00 JST
 *
 * 認証:
 *   Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` を送る。
 *   CRON_SECRET が未設定なら**常に拒否**する（fail closed）。
 *
 * このルートを /internal 配下に置かない理由:
 *   /internal/* は Basic 認証で保護されており、Vercel Cron は
 *   Basic 認証情報を送れないため。代わりに Bearer で独立に保護する。
 */

import { NextResponse, type NextRequest } from "next/server";
import { generateCandidateBatch } from "@/lib/article-factory/candidates";
import { describeStore, getCandidateBatchStore } from "@/lib/article-factory/storage";
import { isValidCronAuth } from "@/lib/article-factory/safety";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: NextRequest) {
  if (!isValidCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    // 認証失敗の理由は返さない（secretの有無を推測させない）
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const store = getCandidateBatchStore();

  try {
    const batch = await generateCandidateBatch({ trigger: "cron" });
    await store.save(batch);

    const storage = describeStore(store);
    return NextResponse.json({
      ok: true,
      batchId: batch.batchId,
      generatedAt: batch.generatedAt,
      candidateCount: batch.candidates.length,
      usableCount: batch.candidates.filter((c) => !c.blocked).length,
      storage,
      notes: batch.notes,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 300) : "候補生成に失敗しました",
      },
      { status: 500 }
    );
  }
}
