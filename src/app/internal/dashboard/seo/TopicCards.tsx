"use client";

import { useState } from "react";
import type { SeoTopicCandidate, SeoTopicSelection } from "@/types/seo-editor";

const TYPE_LABELS: Record<SeoTopicCandidate["type"], string> = {
  cluster_opportunity: "クラスター拡張",
  rewrite_opportunity: "リライト機会",
  cannibalization_risk: "カニバリの可能性",
  ctr_opportunity: "CTR改善",
  new_demand: "新しい需要",
};

const ACTION_LABELS: Record<string, string> = {
  rewrite: "リライト",
  expand: "セクション追加",
  new_article: "新規記事",
  internal_links: "内部リンク",
  merge: "統合",
  title_meta: "タイトル/メタ",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export function TopicCards({
  selection,
  onStart,
  disabled,
}: {
  selection: SeoTopicSelection;
  onStart: (topicId: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(selection.candidates[0]?.id ?? null);

  if (selection.candidates.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-700">改善テーマの候補が見つかりませんでした。</p>
        <p className="text-xs text-gray-500 mt-2">{selection.dataAssessment}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selection.lowDataWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-800">データが薄い状態です</p>
          <p className="text-xs text-amber-800 mt-1">{selection.dataAssessment}</p>
        </div>
      )}
      {!selection.lowDataWarning && (
        <p className="text-xs text-gray-600">{selection.dataAssessment}</p>
      )}

      <div className="space-y-3">
        {selection.candidates.map((c) => {
          const isSelected = selected === c.id;
          return (
            <label
              key={c.id}
              className={`block rounded-lg border p-4 cursor-pointer transition-colors ${
                isSelected ? "border-gray-900 bg-white" : "border-gray-200 bg-white hover:border-gray-400"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="seo-topic"
                  className="mt-1"
                  checked={isSelected}
                  onChange={() => setSelected(c.id)}
                  disabled={disabled}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{c.topic}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600">
                      {TYPE_LABELS[c.type]}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${CONFIDENCE_STYLES[c.dataConfidence]}`}
                    >
                      確度 {c.dataConfidence}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700 mt-2">{c.reason}</p>

                  {c.queries.length > 0 && (
                    <div className="mt-2.5 overflow-x-auto">
                      <table className="text-[11px] w-full">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left font-normal pr-3">主要クエリ</th>
                            <th className="text-right font-normal px-2">表示</th>
                            <th className="text-right font-normal px-2">順位</th>
                            <th className="text-right font-normal px-2">CTR</th>
                            <th className="text-right font-normal pl-2">表示推移</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.queries.slice(0, 5).map((q, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="pr-3 py-1 text-gray-800">{q.query}</td>
                              <td className="text-right px-2 tabular-nums">{q.impressions}</td>
                              <td className="text-right px-2 tabular-nums">{q.position.toFixed(1)}</td>
                              <td className="text-right px-2 tabular-nums">
                                {(q.ctr * 100).toFixed(1)}%
                              </td>
                              <td className="text-right pl-2 tabular-nums">
                                {q.impressionChange === null
                                  ? "—"
                                  : `${q.impressionChange >= 0 ? "+" : ""}${q.impressionChange.toFixed(0)}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {c.relatedPages.length > 0 && (
                    <div className="mt-2 text-[11px] text-gray-600">
                      関連ページ:{" "}
                      {c.relatedPages.map((p, i) => {
                        let path = p;
                        try {
                          path = new URL(p).pathname;
                        } catch {
                          /* keep */
                        }
                        return (
                          <span key={i} className="mr-2 text-blue-600">
                            {path}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.possibleActions.map((a) => (
                      <span
                        key={a}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                      >
                        {ACTION_LABELS[a] ?? a}
                      </span>
                    ))}
                  </div>

                  {c.evidence.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-gray-500 cursor-pointer">
                        Search Console根拠 {c.evidence.length}件
                      </summary>
                      <ul className="mt-1 text-[11px] text-gray-600 list-disc pl-4 space-y-0.5">
                        {c.evidence.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {c.caveats.length > 0 && (
                    <ul className="mt-2 text-[11px] text-amber-700 list-disc pl-4 space-y-0.5">
                      {c.caveats.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        disabled={disabled || !selected}
        onClick={() => selected && onStart(selected)}
        className="w-full rounded-lg bg-gray-900 text-white text-sm font-bold py-3 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
      >
        このテーマでSEO改善を開始
      </button>
      <p className="text-[11px] text-gray-500 text-center">
        開始後、カニバリ監査からQAまでは自動で実行されます。本番反映（PR作成）だけは人間が行います。
      </p>
    </div>
  );
}
