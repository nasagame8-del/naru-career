"use client";

import type { GrowthLabData } from "@/lib/growth-lab";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-gray-400 py-4 text-center">{text}</p>;
}

const SIGNAL_LABEL: Record<string, string> = {
  top10_close: "Top10内",
  striking_distance: "Top10目前",
  new_query: "新規",
  surging: "急上昇",
  watch: "監視",
};

const EXPERIMENT_LABEL: Record<string, string> = {
  title_snippet: "タイトル/スニペット",
  content_expand: "本文拡張",
  internal_links: "内部リンク",
};

export function GrowthLabTab({ data }: { data: GrowthLabData }) {
  const lowAio = data.aioScores.filter((x) => x.score < 70).length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniKpi label="Radar候補" value={data.demandRadar.length} />
        <MiniKpi label="実験候補" value={data.experiments.length} />
        <MiniKpi label="内部リンク候補" value={data.internalLinks.length} />
        <MiniKpi label="AIO 70点未満" value={lowAio} />
        <MiniKpi label="監視ソース" value={data.research.configuredSources} />
      </div>

      <Section
        title="① 検索需要レーダー"
        subtitle="GSCの新規query・Top10目前・低CTR・表示急増をスコア化。高い順に今日の優先テーマ候補。"
      >
        {data.demandRadar.length === 0 ? (
          <Empty text="GSCデータがまだありません" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2">query</th>
                  <th className="text-right">順位</th>
                  <th className="text-right">表示</th>
                  <th className="text-right">click</th>
                  <th className="text-center">signal</th>
                  <th className="text-left pl-3">推奨</th>
                </tr>
              </thead>
              <tbody>
                {data.demandRadar.slice(0, 12).map((item) => (
                  <tr key={item.query} className="border-b border-gray-50">
                    <td className="py-2 font-medium">{item.query}</td>
                    <td className="text-right">{item.position.toFixed(1)}</td>
                    <td className="text-right">{item.impressions}</td>
                    <td className="text-right">{item.clicks}</td>
                    <td className="text-center">
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                        {SIGNAL_LABEL[item.signal] ?? item.signal}
                      </span>
                    </td>
                    <td className="pl-3 text-gray-600">{item.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="② SEO実験エージェント（提案モード）"
        subtitle="4〜20位のqueryを実験候補化。変更は自動公開せず、仮説と7/14/28日評価軸だけ先に作る。"
      >
        {data.experiments.length === 0 ? (
          <Empty text="実験候補なし" />
        ) : (
          <div className="space-y-2">
            {data.experiments.slice(0, 8).map((item) => (
              <div key={item.id} className="border rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-bold">{item.query}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">
                    {EXPERIMENT_LABEL[item.experimentType]}
                  </span>
                  <span className="text-[10px] text-gray-400">pos {item.position.toFixed(1)} / imp {item.impressions}</span>
                </div>
                <p className="text-[11px] text-gray-600">{item.hypothesis}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  成功条件: {item.successMetric} / checkpoints: {item.checkpoints.join("・")}日
                </p>
                <a
                  href={item.page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 hover:underline mt-1 inline-block"
                >
                  {item.slug} ↗
                </a>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="③ 内部リンク自動設計機"
        subtitle="本文・タイトル・主KWの近さを見て、まだ存在しないsource→targetとアンカー候補を提示。"
      >
        {data.internalLinks.length === 0 ? (
          <Empty text="追加候補なし" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2">source</th>
                  <th className="text-left">target</th>
                  <th className="text-left">anchor候補</th>
                  <th className="text-right">score</th>
                  <th className="text-left pl-3">理由</th>
                </tr>
              </thead>
              <tbody>
                {data.internalLinks.slice(0, 20).map((item) => (
                  <tr key={item.sourceSlug + ">" + item.targetSlug} className="border-b border-gray-50">
                    <td className="py-2 font-mono text-[10px]">{item.sourceSlug}</td>
                    <td className="font-mono text-[10px]">{item.targetSlug}</td>
                    <td>{item.anchor}</td>
                    <td className="text-right">{item.score.toFixed(3)}</td>
                    <td className="pl-3 text-gray-500">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="④ AIO引用されやすさQA"
        subtitle="引用を保証する指標ではなく、直接回答・一次情報・日付・FAQ・更新履歴などの編集品質スコア。"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left py-2">記事</th>
                <th className="text-right">score</th>
                <th className="text-center">grade</th>
                <th className="text-left pl-3">不足</th>
              </tr>
            </thead>
            <tbody>
              {data.aioScores.slice(0, 20).map((item) => (
                <tr key={item.slug} className="border-b border-gray-50">
                  <td className="py-2">
                    <a
                      href={"/articles/" + item.slug}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-blue-600 hover:underline"
                    >
                      {item.slug}
                    </a>
                  </td>
                  <td className="text-right font-bold">{item.score}</td>
                  <td className="text-center">
                    <span className={
                      "px-1.5 py-0.5 rounded " +
                      (item.grade === "A" ? "bg-green-50 text-green-700" :
                       item.grade === "B" ? "bg-blue-50 text-blue-700" :
                       item.grade === "C" ? "bg-amber-50 text-amber-700" :
                       "bg-red-50 text-red-700")
                    }>
                      {item.grade}
                    </span>
                  </td>
                  <td className="pl-3 text-gray-500">{item.missing.join(" / ") || "なし"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="⑤ 独自データ製造ライン"
        subtitle="一次情報URLを本文保存なしで監視し、HTTP状態・title・hash差分だけを記録する試作。週1＋手動実行。"
      >
        <div className="grid grid-cols-3 gap-3 mb-3">
          <MiniKpi label="登録ソース" value={data.research.configuredSources} />
          <MiniKpi label="変更検知" value={data.research.changedSources} />
          <MiniKpi label="取得失敗" value={data.research.failedSources} />
        </div>
        <div className="space-y-1.5">
          {data.research.sources.map((source) => (
            <div key={source.id} className="flex items-center gap-3 text-[11px] border-b border-gray-50 py-1.5">
              <span className="min-w-[90px] text-gray-400">{source.category}</span>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex-1">
                {source.label}
              </a>
              <span className="text-gray-400">{source.cadence}</span>
              <span className={
                source.status?.error
                  ? "text-red-600"
                  : source.status?.changed
                    ? "text-amber-700 font-bold"
                    : "text-gray-400"
              }>
                {source.status?.error ? "取得失敗" : source.status?.changed ? "変更あり" : source.status?.checkedAt ? "変化なし" : "未実行"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-[10px] text-gray-400 text-right">
        generated: {new Date(data.generatedAt).toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
