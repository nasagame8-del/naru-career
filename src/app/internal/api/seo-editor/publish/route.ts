/**
 * SEO Editor — 本番反映（Pull Request作成）
 *
 * AIが勝手に本番公開することはない。ここが行うのは PR の作成までで、
 * マージは人間が行う。main/master への直接pushは実装していない。
 *
 * ガード:
 *   - Basic認証
 *   - Runの署名検証 + スキーマ検証（改ざんされたPhase結果では実行されない）
 *   - QAがFAILなら拒否
 *   - 書き込み先パスのホワイトリスト
 *   - SEO_EDITOR_BASE_BRANCH 未設定なら拒否
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/seo-editor/auth";
import { verifySignedRun, RunSignatureError, signRun } from "@/lib/seo-editor/signature";
import { validateSeoRun, ValidationError } from "@/lib/seo-editor/validate";
import { canPublish } from "@/lib/seo-editor/phases/phase9-qa";
import { githubReadiness, publishAsPullRequest, GithubError } from "@/lib/seo-editor/github";
import { LIMITS } from "@/lib/seo-editor/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PREVIEW_NOTE =
  "このVercelプロジェクトはGitHub連携が未接続のため、このPRではVercel Previewが自動生成されません。既知の制約です。";

/** 設定状況の確認（secretは返さない） */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
    });
  }
  const readiness = githubReadiness();
  return NextResponse.json({ ...readiness, previewNote: PREVIEW_NOTE });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストボディが不正です" }, { status: 400 });
  }

  let run;
  try {
    run = validateSeoRun(verifySignedRun(body.signedRun));
  } catch (e) {
    if (e instanceof RunSignatureError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, error: `Runの形式が不正です — ${e.message}` },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "Runを復元できませんでした" }, { status: 400 });
  }

  // ── QAガード ──
  const qaPhase = run.phases.find((p) => p.phase === "qa");
  if (qaPhase?.state !== "done") {
    return NextResponse.json(
      { ok: false, error: "QAが完了していません。Phase 9を実行してください" },
      { status: 400 }
    );
  }
  const publishable = canPublish(run.qa);
  if (!publishable.allowed) {
    return NextResponse.json({ ok: false, error: publishable.reason }, { status: 400 });
  }

  if (run.publish) {
    return NextResponse.json(
      { ok: false, error: `このRunは既にPR #${run.publish.prNumber} を作成済みです` },
      { status: 409 }
    );
  }

  const changes = run.changes.filter((c) => c.operation !== "DELETE" || c.before !== null);
  if (changes.length === 0) {
    return NextResponse.json({ ok: false, error: "反映する変更がありません" }, { status: 400 });
  }
  if (changes.length > LIMITS.maxChanges) {
    return NextResponse.json(
      { ok: false, error: `変更ファイル数が上限（${LIMITS.maxChanges}）を超えています` },
      { status: 400 }
    );
  }

  const readiness = githubReadiness();
  if (!readiness.ready) {
    return NextResponse.json({ ok: false, error: readiness.reasons.join(" / ") }, { status: 400 });
  }

  try {
    const result = await publishAsPullRequest({ run, changes, previewNote: PREVIEW_NOTE });
    const published = {
      ...run,
      status: "published" as const,
      publish: result,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json({ ok: true, signedRun: signRun(published), publish: result });
  } catch (e) {
    const message =
      e instanceof GithubError
        ? e.message
        : e instanceof Error
          ? e.message.slice(0, 300)
          : "PR作成に失敗しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
