import type { ComparisonTableProps } from "@/components/ComparisonTable";
import type { FlowDiagramProps } from "@/components/FlowDiagram";

export type ArticleWidget =
  | { type: "comparison-table"; id: string; props: ComparisonTableProps }
  | { type: "flow-diagram"; id: string; props: FlowDiagramProps };

/**
 * 記事slug → その記事で使うウィジェット一覧
 */
export const ARTICLE_WIDGETS: Record<string, ArticleWidget[]> = {
  "agent-comparison-2026": [
    {
      type: "comparison-table",
      id: "agent-comparison-main",
      props: {
        headers: ["doda", "ワークポート"],
        rows: [
          { label: "タイプ", values: ["求人検索型（自走向き）", "伴走型（サポート重視）"] },
          { label: "求人の幅", values: ["業界トップクラスの求人数", "IT/Web系に強い"] },
          { label: "サポート", values: ["メッセージ中心でスムーズ", "面談・フォローが手厚い"] },
          { label: "書類支援", values: ["テンプレートあり", "eコンシェル（専用ツール）"] },
          { label: "強み", values: ["自分で比較検討できる", "エージェントが親身に伴走"] },
          { label: "注意点", values: ["自分から動く必要あり", "紹介案件数がやや少なめ"] },
          { label: "向いている人", values: ["自走型の第二新卒", "初めての転職で不安な人"] },
        ],
        note: "筆者の実体験に基づく比較です。利用時期や担当者により印象は異なる場合があります",
      },
    },
  ],

  "agent-site-vs-agent-usage": [
    {
      type: "comparison-table",
      id: "site-vs-agent",
      props: {
        headers: ["転職サイト（doda）", "転職エージェント（ワークポート）"],
        rows: [
          { label: "役割", values: ["自分で探す道具", "プロに提案してもらう仕組み"] },
          { label: "求人の探し方", values: ["自分で検索・自己応募", "エージェントが紹介"] },
          { label: "サポート", values: ["求人閲覧・応募機能", "書類添削・面接対策・日程調整"] },
          { label: "強み", values: ["市場全体が見える", "非公開求人・プロの提案"] },
          { label: "注意点", values: ["裏取りは自己責任", "紹介案件数に限りあり"] },
          { label: "筆者の結果", values: ["自己応募で内定獲得", "書類・面接準備をサポート"] },
        ],
        note: "筆者の実体験に基づく比較です。dodaはサイト・エージェント両方の機能を持ちます",
      },
    },
  ],

  "ai-interview-screening": [
    {
      type: "flow-diagram",
      id: "ai-interview-flow",
      props: {
        steps: [
          { title: "応募", description: "求人に応募・書類提出" },
          { title: "AI面接", description: "録画型/対話型でAIが回答を分析" },
          { title: "人事確認", description: "AIスコアを参考に人事が判断" },
          { title: "面接", description: "人間の面接官による選考" },
          { title: "内定", description: "最終判断は人が行う" },
        ],
        caption: "AI面接を導入している企業の一般的な選考フロー",
      },
    },
  ],
};
