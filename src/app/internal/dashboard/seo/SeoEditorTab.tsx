"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SEO_PHASE_LABELS,
  type SeoPhaseId,
  type SeoRun,
  type SignedRun,
} from "@/types/seo-editor";
import { RunProgress } from "./RunProgress";
import { TopicCards } from "./TopicCards";
import { ChangeDiff } from "./ChangeDiff";

const API = "/internal/api/seo-editor";
const PUBLISH_API = "/internal/api/seo-editor/publish";
/** UI状態の復元にのみ使う。正本はサーバーが署名したRun */
const STORAGE_KEY = "naru.seo-editor.signed-run";

/** QA所見の表示順と、origin の表示ラベル */
const VERDICT_RANK: Record<string, number> = { FAIL: 0, NEEDS_REVIEW: 1, WARNING: 2, PASS: 3 };
const ORIGIN_LABELS: Record<string, string> = {
  INTRODUCED: "今回発生",
  REGRESSED: "今回悪化",
  PRE_EXISTING: "既存",
  UNKNOWN: "帰属不明",
};

/** Phase 2以降の実行順。Phase 1（テーマ候補）は人間の選択を挟むため別扱い */
const PIPELINE: SeoPhaseId[] = [
  "cannibalization",
  "cluster",
  "action",
  "links",
  "brief",
  "write",
  "related",
  "qa",
];
/** 対象を1件ずつ処理するPhase */
const INDEXED: SeoPhaseId[] = ["brief", "write", "related"];

interface ApiResponse {
  ok: boolean;
  signedRun: SignedRun;
  hasMore?: boolean;
  nextIndex?: number;
  gscFromCache?: boolean;
  error?: string;
  failedPhase?: SeoPhaseId;
}

/**
 * localStorage からのUI状態復元。
 * 正本ではないため、復元できなくても動作に影響しない。
 * サーバーは必ず署名とスキーマを検証するので、書き換えられていれば弾かれる。
 */
function restoreSignedRun(): SignedRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignedRun) : null;
  } catch {
    return null;
  }
}

export function SeoEditorTab() {
  const [signed, setSigned] = useState<SignedRun | null>(restoreSignedRun);
  const [busyPhase, setBusyPhase] = useState<SeoPhaseId | null>(null);
  const [subLabel, setSubLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedPhase, setFailedPhase] = useState<SeoPhaseId | null>(null);
  const [gscFromCache, setGscFromCache] = useState<boolean | null>(null);
  const [publishReady, setPublishReady] = useState<{ ready: boolean; reasons: string[] } | null>(
    null
  );
  const [publishing, setPublishing] = useState(false);

  const run: SeoRun | null = signed?.run ?? null;

  // GitHub連携の設定状況を確認する（secretは返ってこない）
  useEffect(() => {
    fetch(PUBLISH_API)
      .then((r) => r.json())
      .then((d) => setPublishReady({ ready: Boolean(d.ready), reasons: d.reasons ?? [] }))
      .catch(() => setPublishReady({ ready: false, reasons: ["設定を確認できませんでした"] }));
  }, []);

  const persist = useCallback((next: SignedRun | null) => {
    setSigned(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorageが使えなくても続行できる */
    }
  }, []);

  const call = useCallback(
    async (body: Record<string, unknown>): Promise<ApiResponse> => {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ApiResponse;
      if (data.signedRun) persist(data.signedRun);
      return data;
    },
    [persist]
  );

  /** Phase 2〜9 を順に実行する。失敗したPhaseで停止し、そこから再開できる */
  const runPipeline = useCallback(
    async (from: SeoPhaseId, seed: SignedRun, topicId?: string) => {
      setError(null);
      setFailedPhase(null);
      let current = seed;
      const start = PIPELINE.indexOf(from);

      for (let i = Math.max(0, start); i < PIPELINE.length; i++) {
        const phase = PIPELINE[i];
        setBusyPhase(phase);
        setSubLabel(null);

        let index = 0;
        for (;;) {
          if (INDEXED.includes(phase) && index > 0) {
            setSubLabel(`${index + 1}件目`);
          }
          const res = await call({
            action: phase,
            signedRun: current,
            ...(phase === "cannibalization" && topicId ? { topicId } : {}),
            ...(INDEXED.includes(phase) ? { index } : {}),
          });

          if (!res.ok) {
            setBusyPhase(null);
            setSubLabel(null);
            setError(res.error ?? "不明なエラー");
            setFailedPhase(res.failedPhase ?? phase);
            return;
          }
          current = res.signedRun;

          if (res.hasMore && typeof res.nextIndex === "number") {
            index = res.nextIndex;
            continue;
          }
          break;
        }
      }

      setBusyPhase(null);
      setSubLabel(null);
    },
    [call]
  );

  const loadTopics = useCallback(
    async (refresh: boolean) => {
      setBusyPhase("topics");
      setError(null);
      setFailedPhase(null);
      const res = await call({ action: "topics", signedRun: null, refreshGsc: refresh });
      setBusyPhase(null);
      setGscFromCache(res.gscFromCache ?? null);
      if (!res.ok) {
        setError(res.error ?? "テーマ候補を取得できませんでした");
        setFailedPhase("topics");
      }
    },
    [call]
  );

  const start = useCallback(
    (topicId: string) => {
      if (!signed) return;
      void runPipeline("cannibalization", signed, topicId);
    },
    [signed, runPipeline]
  );

  const resume = useCallback(() => {
    if (!signed || !failedPhase) return;
    if (failedPhase === "topics") {
      void loadTopics(false);
      return;
    }
    void runPipeline(failedPhase, signed, signed.run.selectedTopic?.id);
  }, [signed, failedPhase, runPipeline, loadTopics]);

  const publish = useCallback(async () => {
    if (!signed) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(PUBLISH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedRun: signed }),
      });
      const data = (await res.json()) as ApiResponse & { publish?: { prUrl: string } };
      if (data.signedRun) persist(data.signedRun);
      if (!data.ok) setError(data.error ?? "PRを作成できませんでした");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PRの作成に失敗しました");
    } finally {
      setPublishing(false);
    }
  }, [signed, persist]);

  const busy = busyPhase !== null || publishing;
  const qa = run?.qa ?? null;
  const qaFailed = qa?.overall === "FAIL";
  const pipelineDone = run?.phases.find((p) => p.phase === "qa")?.state === "done";

  return (
    <div className="space-y-5">
      {/* ── ヘッダ ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-gray-900">SEO Editor</h2>
          <p className="text-[11px] text-gray-500">
            人間が判断するのは「テーマの選択」と「本番反映」の2点だけです
          </p>
        </div>
        <div className="flex items-center gap-2">
          {gscFromCache !== null && (
            <span className="text-[10px] text-gray-400">
              GSC: {gscFromCache ? "キャッシュ利用" : "APIから取得"}
            </span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadTopics(false)}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {run?.selection ? "テーマを再取得" : "改善テーマを分析"}
          </button>
          {run && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                persist(null);
                setError(null);
                setFailedPhase(null);
                setGscFromCache(null);
              }}
              className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              リセット
            </button>
          )}
        </div>
      </div>

      {busyPhase === "topics" && (
        <p className="text-xs text-blue-600">Search Consoleと既存記事を分析しています…</p>
      )}

      {/* ── エラー / 再開 ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-800">
            {failedPhase ? `「${SEO_PHASE_LABELS[failedPhase]}」で失敗しました` : "エラー"}
          </p>
          <p className="text-xs text-red-700 mt-1 break-words">{error}</p>
          {failedPhase && signed && (
            <button
              type="button"
              disabled={busy}
              onClick={resume}
              className="mt-2 text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            >
              このPhaseから再開
            </button>
          )}
        </div>
      )}

      {/* ── STEP 1: テーマ選択 ── */}
      {run?.selection && !run.selectedTopic && (
        <TopicCards selection={run.selection} onStart={start} disabled={busy} />
      )}

      {/* ── 実行画面 ── */}
      {run?.selectedTopic && (
        <>
          <RunProgress run={run} busyPhase={busyPhase} subLabel={subLabel} />

          {/* 監査結果サマリ */}
          <div className="grid gap-3 sm:grid-cols-2">
            {run.cannibalization && (
              <Panel title="カニバリ監査">
                <p className="text-xs">
                  <Badge>{run.cannibalization.status}</Badge>
                  <span className="ml-2 text-gray-500">確度 {run.cannibalization.confidence}</span>
                </p>
                <p className="text-xs text-gray-700 mt-1.5">{run.cannibalization.reason}</p>
                <p className="text-xs text-gray-700 mt-1.5">
                  推奨: {run.cannibalization.recommendedAction}
                </p>
              </Panel>
            )}
            {run.clusterAudit && (
              <Panel title="Pillar / Cluster">
                <p className="text-xs text-gray-800">
                  Pillar: {run.clusterAudit.pillar.title}（{run.clusterAudit.pillar.status}）
                </p>
                <ul className="mt-1.5 text-[11px] text-gray-700 space-y-0.5">
                  {run.clusterAudit.nodes.slice(0, 8).map((n) => (
                    <li key={n.slug}>
                      <span className="text-gray-400">{n.role}</span> {n.title}
                      <span className="text-gray-400"> / {n.coverage}</span>
                    </li>
                  ))}
                </ul>
                {run.clusterAudit.missingTopics.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] font-bold text-gray-600">不足テーマ</p>
                    <ul className="text-[11px] text-gray-700 list-disc pl-4">
                      {run.clusterAudit.missingTopics.map((m, i) => (
                        <li key={i}>
                          {m.topic}
                          {m.canBeCoveredBy ? (
                            <span className="text-gray-400">（{m.canBeCoveredBy} に追加可能）</span>
                          ) : m.independentPageJustified ? (
                            <span className="text-amber-700">（新規ページ妥当）</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            )}
            {run.actionDecision && (
              <Panel title="編集方針">
                <p className="text-xs text-gray-700">{run.actionDecision.summary}</p>
                <ul className="mt-1.5 text-[11px] space-y-1">
                  {run.actionDecision.decisions.map((d, i) => (
                    <li key={i}>
                      <Badge>{d.action}</Badge>{" "}
                      <code className="text-gray-800">{d.target}</code>
                      <span className="text-gray-600"> — {d.reason}</span>
                      {d.risk && <span className="block text-amber-700">リスク: {d.risk}</span>}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {run.internalLinks && (
              <Panel title={`内部リンク設計（${run.internalLinks.links.length}件）`}>
                <ul className="text-[11px] space-y-1">
                  {run.internalLinks.links.map((l, i) => (
                    <li key={i}>
                      <Badge>{l.operation}</Badge>{" "}
                      <span className="text-gray-800">
                        {l.source} → {l.target}
                      </span>
                      <span className="block text-gray-500">
                        「{l.anchor}」 / {l.placement}
                      </span>
                    </li>
                  ))}
                </ul>
                {run.internalLinks.rejected.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[11px] text-gray-500 cursor-pointer">
                      検証で除外 {run.internalLinks.rejected.length}件
                    </summary>
                    <ul className="text-[11px] text-gray-500 list-disc pl-4 mt-1">
                      {run.internalLinks.rejected.map((r, i) => (
                        <li key={i}>
                          {r.link.source} → {r.link.target}: {r.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Panel>
            )}
          </div>

          {/* SEO Brief */}
          {run.briefs.length > 0 && (
            <Panel title={`SEO Brief（${run.briefs.length}件）`}>
              <div className="space-y-3">
                {run.briefs.map((b) => (
                  <details key={b.target} className="text-[11px]">
                    <summary className="cursor-pointer text-gray-800">
                      <Badge>{b.action}</Badge> <code>{b.target}</code> — {b.primaryIntent}
                    </summary>
                    <dl className="mt-1.5 space-y-1 pl-4 text-gray-700">
                      <Row label="対象読者" value={b.targetReader} />
                      <Row label="クラスターでの役割" value={b.roleInCluster} />
                      <Row label="必ず答えること" value={b.mustAnswer.join(" / ")} />
                      <Row label="構成案" value={b.recommendedHeadings.join(" / ")} />
                      <Row label="使える一次体験" value={b.firstPartyEvidence.join(" / ") || "なし"} />
                      <Row label="残すもの" value={b.preserve.join(" / ") || "—"} />
                      <Row label="創作禁止" value={b.doNotInvent.join(" / ")} />
                    </dl>
                  </details>
                ))}
              </div>
            </Panel>
          )}

          {/* ── 結果 ── */}
          {pipelineDone && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">実行結果</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Stat
                  label="新規記事"
                  value={run.changes.filter((c) => c.operation === "CREATE").length}
                />
                <Stat
                  label="リライト・更新"
                  value={run.changes.filter((c) => c.operation === "UPDATE").length}
                />
                <Stat
                  label="内部リンク追加"
                  value={run.internalLinks?.links.filter((l) => l.operation === "ADD").length ?? 0}
                />
                <Stat
                  label="内部リンク削除"
                  value={
                    run.internalLinks?.links.filter((l) => l.operation === "REMOVE").length ?? 0
                  }
                />
              </div>

              {qa && (
                <div
                  className={`rounded border p-3 mb-4 ${
                    qa.overall === "PASS" || qa.overall === "WARNING"
                      ? "border-green-200 bg-green-50"
                      : qa.overall === "FAIL"
                        ? "border-red-200 bg-red-50"
                        : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <p className="text-xs font-bold">QA: {qa.overall}</p>
                  <p className="text-xs mt-1">{qa.summary}</p>
                  {qa.issues.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[11px]">
                      {[...qa.issues]
                        .sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict])
                        .map((it, i) => (
                          <li key={i}>
                            <span className="font-bold">{it.verdict}</span>{" "}
                            <span
                              className={
                                it.origin === "PRE_EXISTING" ? "text-gray-500" : "text-gray-700"
                              }
                            >
                              [{ORIGIN_LABELS[it.origin]}]
                            </span>{" "}
                            <span className="text-gray-600">[{it.category}]</span>{" "}
                            <code className="text-gray-700">{it.target}</code> — {it.message}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {run.changes.map((c) => (
                  <ChangeDiff key={c.path} change={c} />
                ))}
              </div>

              {/* ── 本番反映 ── */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                {run.publish ? (
                  <div className="rounded border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-bold text-green-800">
                      Pull Request #{run.publish.prNumber} を作成しました
                    </p>
                    <a
                      href={run.publish.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline break-all"
                    >
                      {run.publish.prUrl}
                    </a>
                    <p className="text-[11px] text-green-800 mt-1">
                      ベース: {run.publish.baseBranch} / ブランチ: {run.publish.branch}
                    </p>
                    {run.publish.previewNote && (
                      <p className="text-[11px] text-amber-700 mt-1">{run.publish.previewNote}</p>
                    )}
                    <p className="text-[11px] text-gray-600 mt-1">
                      マージは人間が判断してください。
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy || qaFailed || !publishReady?.ready || run.changes.length === 0}
                      onClick={() => void publish()}
                      className="w-full rounded-lg bg-gray-900 text-white text-sm font-bold py-3 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800"
                    >
                      {publishing ? "Pull Requestを作成しています…" : "GitHubにPull Requestを作成"}
                    </button>
                    {qaFailed && (
                      <p className="text-[11px] text-red-700 mt-1.5">
                        今回の変更が新規発生・悪化させた問題があるため反映できません。
                        「既存」と表示されている指摘はブロック理由ではありません。
                      </p>
                    )}
                    {publishReady && !publishReady.ready && (
                      <ul className="text-[11px] text-amber-700 mt-1.5 list-disc pl-4">
                        {publishReady.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      作成されるのはPRのみです。main/masterへの直接pushは行いません。
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!run && busyPhase === null && (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-600">
            「改善テーマを分析」でSearch Consoleと既存記事の分析を開始します。
          </p>
        </div>
      )}
    </div>
  );
}

// ── 小物 ──

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="text-xs font-bold text-gray-900 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700">
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-400 shrink-0 w-28">{label}</dt>
      <dd className="text-gray-700">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 p-2 text-center">
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
