"use client";

/**
 * 新規記事タブ。
 *
 * 役割:
 *   - 候補カード（3〜5件）の表示と選択
 *   - 選択後の耐久実行の進捗表示
 *   - リロード後の再接続（runId を localStorage に保持し、ストリームを読み直す）
 *
 * 進捗はサーバー側のワークフローが正本であり、この画面は表示するだけ。
 * ブラウザを閉じても実行は継続する。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ARTICLE_PHASES,
  PHASE_LABELS,
  type ArticleCandidate,
  type ArticlePhase,
  type CandidateBatch,
  type PhaseState,
  type WorkflowEvent,
} from "@/lib/article-factory/types";

const RUN_STORAGE_KEY = "naru.article-factory.runId";

interface StorageInfo {
  kind: string;
  durable: boolean;
  warning: string | null;
}

interface CandidatesResponse {
  ok: boolean;
  batch: CandidateBatch | null;
  storage: StorageInfo;
  meetsQuota: boolean;
  error?: string;
}

type PhaseMap = Record<ArticlePhase, { state: PhaseState; message: string }>;

function emptyPhases(): PhaseMap {
  return ARTICLE_PHASES.reduce((acc, p) => {
    acc[p] = { state: "pending", message: "" };
    return acc;
  }, {} as PhaseMap);
}

export function NewArticleTab() {
  const [batch, setBatch] = useState<CandidateBatch | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [runId, setRunId] = useState<string | null>(null);
  const [phases, setPhases] = useState<PhaseMap>(emptyPhases);
  const [blocked, setBlocked] = useState<{ reason: string; code: string } | null>(null);
  const [result, setResult] = useState<{
    prUrl: string | null;
    prNumber: number | null;
    productionUrl: string | null;
    published: boolean;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ── 候補の取得 ──

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/internal/api/article-factory/candidates", {
        cache: "no-store",
      });
      const data = (await res.json()) as CandidatesResponse;
      setStorage(data.storage ?? null);
      if (!data.ok) {
        setError(data.error ?? "候補を取得できませんでした");
        return;
      }
      setBatch(data.batch);
    } catch {
      setError("候補の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const generateCandidates = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/internal/api/article-factory/candidates", {
        method: "POST",
      });
      const data = (await res.json()) as CandidatesResponse;
      setStorage(data.storage ?? null);
      if (!data.ok) {
        setError(data.error ?? "候補生成に失敗しました");
        return;
      }
      setBatch(data.batch);
    } catch {
      setError("候補生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }, []);

  // ── 進捗ストリームへの接続（再接続にも使う） ──

  const connect = useCallback((id: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhases(emptyPhases());
    setBlocked(null);
    setResult(null);

    (async () => {
      try {
        const res = await fetch(
          `/internal/api/article-factory/status?runId=${encodeURIComponent(id)}&startIndex=0`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!res.ok || !res.body) {
          setError("進捗を取得できませんでした（実行が見つかりません）");
          return;
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: WorkflowEvent;
            try {
              event = JSON.parse(line) as WorkflowEvent;
            } catch {
              continue;
            }
            applyEvent(event);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("進捗ストリームが切断されました。再読み込みで再接続できます");
        }
      }
    })();

    function applyEvent(event: WorkflowEvent) {
      if (event.type === "phase") {
        setPhases((prev) => ({
          ...prev,
          [event.phase]: { state: event.state, message: event.message },
        }));
      } else if (event.type === "blocked") {
        setBlocked({ reason: event.reason, code: event.code });
        setPhases((prev) => ({
          ...prev,
          [event.phase]: { state: "failed", message: event.reason },
        }));
      } else if (event.type === "completed") {
        setResult({
          prUrl: event.prUrl,
          prNumber: event.prNumber,
          productionUrl: event.productionUrl,
          published: event.published,
        });
      }
    }
  }, []);

  // ── 初回ロード + リロード後の再接続 ──

  useEffect(() => {
    let cancelled = false;

    // 状態更新は必ず await の後（= 非同期コールバック内）で行う。
    // effect本体で同期的にsetStateすると連鎖レンダリングになるため。
    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      void loadCandidates();

      let saved: string | null = null;
      try {
        saved = localStorage.getItem(RUN_STORAGE_KEY);
      } catch {
        saved = null;
      }
      if (saved && !cancelled) {
        setRunId(saved);
        connect(saved);
      }
    })();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [loadCandidates, connect]);

  // ── 記事作成の開始 ──

  const startRun = useCallback(
    async (candidate: ArticleCandidate) => {
      if (!batch) return;
      setError(null);
      try {
        const res = await fetch("/internal/api/article-factory/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: batch.batchId, candidateId: candidate.id }),
        });
        const data = (await res.json()) as { ok: boolean; runId?: string; error?: string };
        if (!data.ok || !data.runId) {
          setError(data.error ?? "実行を開始できませんでした");
          return;
        }
        setRunId(data.runId);
        try {
          localStorage.setItem(RUN_STORAGE_KEY, data.runId);
        } catch {
          /* localStorage が使えなくても実行は継続する */
        }
        connect(data.runId);
      } catch {
        setError("実行を開始できませんでした");
      }
    },
    [batch, connect]
  );

  const clearRun = useCallback(() => {
    abortRef.current?.abort();
    setRunId(null);
    setPhases(emptyPhases());
    setBlocked(null);
    setResult(null);
    try {
      localStorage.removeItem(RUN_STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  // ── 描画 ──

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">新規記事オートパイロット</h2>
          <p className="mt-1 text-sm text-gray-500">
            既存記事と重複しない新しい記事を提案し、選ぶだけで調査・執筆・QA・PR作成まで進みます。
            ブラウザを閉じても実行は継続します。
          </p>
        </div>
        <button
          onClick={generateCandidates}
          disabled={generating}
          className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {generating ? "生成中…" : "候補を生成"}
        </button>
      </header>

      {storage && !storage.durable && storage.warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">保存先の注意: </span>
          {storage.warning}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── 実行中の進捗 ── */}
      {runId && (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">実行状況</h3>
              <p className="mt-0.5 font-mono text-xs text-gray-500">runId: {runId}</p>
            </div>
            <button
              onClick={clearRun}
              className="shrink-0 text-xs text-gray-500 underline hover:text-gray-700"
            >
              表示をクリア
            </button>
          </div>

          <ol className="space-y-2">
            {ARTICLE_PHASES.map((p) => {
              const s = phases[p];
              return (
                <li key={p} className="flex items-start gap-3 text-sm">
                  <PhaseBadge state={s.state} />
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{PHASE_LABELS[p]}</span>
                    {s.message && (
                      <span className="ml-2 text-gray-500">{s.message}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {blocked && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="font-medium">安全に停止しました（{blocked.code}）</div>
              <p className="mt-1">{blocked.reason}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <div className="font-medium">
                {result.published ? "公開まで完了しました" : "PRを作成しました（未公開）"}
              </div>
              <div className="mt-2 space-y-1">
                {result.prUrl && (
                  <div>
                    <a
                      href={result.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Pull Request #{result.prNumber}
                    </a>
                  </div>
                )}
                {result.productionUrl && (
                  <div>
                    <a
                      href={result.productionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      本番URL
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 候補カード ── */}
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : !batch ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center">
          <p className="text-sm text-gray-500">
            候補がまだありません。「候補を生成」を押すか、毎日 08:00（JST）の自動生成をお待ちください。
          </p>
        </div>
      ) : (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="font-mono">{batch.batchId}</span>
            <span>生成: {new Date(batch.generatedAt).toLocaleString("ja-JP")}</span>
            <span>トリガー: {batch.trigger === "cron" ? "自動（08:00 JST）" : "手動"}</span>
            <span>既存記事 {batch.inventorySize} 本</span>
            <span>次の記事ID: {batch.nextArticleId}</span>
          </div>

          {batch.notes.length > 0 && (
            <ul className="mb-4 space-y-1 text-xs text-gray-500">
              {batch.notes.map((n, i) => (
                <li key={i}>・{n}</li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {batch.candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                disabled={Boolean(runId)}
                onSelect={() => startRun(c)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── 部品 ──

const PHASE_STATE_STYLES: Record<PhaseState, { dot: string; label: string }> = {
  pending: { dot: "bg-gray-200", label: "待機" },
  running: { dot: "bg-blue-500 animate-pulse", label: "実行中" },
  done: { dot: "bg-green-500", label: "完了" },
  failed: { dot: "bg-red-500", label: "失敗" },
  skipped: { dot: "bg-amber-400", label: "スキップ" },
};

function PhaseBadge({ state }: { state: PhaseState }) {
  const s = PHASE_STATE_STYLES[state];
  return (
    <span className="mt-1.5 flex shrink-0 items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      <span className="sr-only">{s.label}</span>
    </span>
  );
}

const INTENT_LABELS: Record<string, string> = {
  know: "知りたい",
  do: "やり方を知りたい",
  compare: "比較したい",
  decide: "決めたい",
};

function CandidateCard({
  candidate,
  disabled,
  onSelect,
}: {
  candidate: ArticleCandidate;
  disabled: boolean;
  onSelect: () => void;
}) {
  const unusable = candidate.blocked;

  return (
    <article
      className={`flex flex-col rounded-lg border p-4 ${
        unusable ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      <h3 className="text-sm font-semibold leading-snug text-gray-900">{candidate.title}</h3>

      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-gray-500">キーワード</dt>
          <dd className="mt-0.5 font-mono text-gray-800">{candidate.primaryKeyword}</dd>
        </div>
        <div>
          <dt className="text-gray-500">検索意図</dt>
          <dd className="mt-0.5 text-gray-800">
            {INTENT_LABELS[candidate.searchIntent] ?? candidate.searchIntent}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">既存記事との差分</dt>
          <dd className="mt-0.5 text-gray-700">{candidate.differenceFromExisting}</dd>
        </div>
        <div>
          <dt className="text-gray-500">いま書く理由</dt>
          <dd className="mt-0.5 text-gray-700">{candidate.reasonToWriteNow}</dd>
        </div>
      </dl>

      {candidate.riskFlags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1">
          {candidate.riskFlags.map((f) => (
            <li
              key={f}
              className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
            >
              {f}
            </li>
          ))}
        </ul>
      )}

      {unusable && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
          実行不可: {candidate.blockedReasons.join(" / ")}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-gray-400">{candidate.proposedSlug}</span>
        <button
          onClick={onSelect}
          disabled={disabled || unusable}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          この記事を作る
        </button>
      </div>
    </article>
  );
}
