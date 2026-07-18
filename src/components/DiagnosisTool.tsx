"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// --- Types ---

type JobType = "engineer" | "marketer" | "cs" | "sales" | "pm";

type AgentRecommendation = {
  key: string;
  name: string;
  reason: string;
  affiliate: boolean;
  url?: string;
};

type JobTypeInfo = {
  label: string;
  emoji: string;
  description: string;
  articles: { slug: string; title: string }[];
  agents: AgentRecommendation[];
};

const JOB_TYPES: Record<JobType, JobTypeInfo> = {
  engineer: {
    label: "エンジニア系（モノづくり型）",
    emoji: "🛠",
    description:
      "手を動かしてモノを作ることに充実感を覚えるタイプです。コードやシステムといった「目に見える成果物」がモチベーションになります。第二新卒からエンジニアを目指す場合、未経験OKの自社開発・受託開発企業や、研修制度が充実したSES企業が選択肢になります。プログラミング学習を始めてからでも遅くありません。",
    articles: [
      { slug: "web-industry-guide", title: "未経験からWeb業界を目指す人のための業界ガイド" },
      { slug: "second-new-grad-programming-career-change", title: "プログラミング未経験から第二新卒でIT転職する方法" },
    ],
    agents: [
      { key: "doda", name: "doda", reason: "未経験OKのIT求人が豊富", affiliate: true },
      { key: "neo_career_agent", name: "第二新卒エージェントneo", reason: "20代未経験のIT転職に特化したサポート", affiliate: false, url: "https://www.daini-agent.jp/" },
    ],
  },
  marketer: {
    label: "Webマーケター・AIO系（分析・発信型）",
    emoji: "📊",
    description:
      "データを見て仮説を立て、施策を回すことが好きなタイプです。SEO、広告運用、SNS運用、AIO対策など、Webマーケティングの領域は広く、未経験からでも入りやすいポジションがあります。数字で成果が見えるので、手応えを感じやすい仕事です。",
    articles: [
      { slug: "aio-seo-industry-inside", title: "未経験からAIO/SEO業界に入ってみて分かったこと" },
      { slug: "web-industry-guide", title: "未経験からWeb業界を目指す人のための業界ガイド" },
    ],
    agents: [
      { key: "doda", name: "doda", reason: "マーケ職の求人が見つかりやすい", affiliate: true },
      { key: "neo_career_agent", name: "第二新卒エージェントneo", reason: "未経験からのマーケ転職を個別サポート", affiliate: false, url: "https://www.daini-agent.jp/" },
    ],
  },
  cs: {
    label: "カスタマーサクセス系（伴走・関係構築型）",
    emoji: "🤝",
    description:
      "人と深く関わりながら課題を解決することにやりがいを感じるタイプです。SaaS企業を中心に需要が伸びている職種で、営業経験やコミュニケーション力がそのまま活かせます。「売って終わり」ではなく、顧客と長期的な関係を築きたい人に向いています。",
    articles: [
      { slug: "web-industry-guide", title: "未経験からWeb業界を目指す人のための業界ガイド" },
    ],
    agents: [
      { key: "doda", name: "doda", reason: "CS職の求人が増加中", affiliate: true },
      { key: "neo_career_agent", name: "第二新卒エージェントneo", reason: "カスタマーサクセス職への転職相談が可能", affiliate: false, url: "https://www.daini-agent.jp/" },
    ],
  },
  sales: {
    label: "営業系（対人・数字型）",
    emoji: "📞",
    description:
      "人と話すことが好きで、目標達成に向けて動くことにやりがいを感じるタイプです。IT/Web業界の営業は、テレアポだけでなくインサイドセールスやフィールドセールスなど形態が多様で、未経験からでも入りやすいのが特徴です。僕自身もこのタイプで、AIO対策企業に営業職として入社しました。",
    articles: [
      { slug: "second-new-grad-it-career-change", title: "第二新卒がIT/Web業界へ転職する完全ガイド" },
      { slug: "agent-comparison-2026", title: "第二新卒の転職で使ったエージェント比較" },
    ],
    agents: [
      { key: "doda", name: "doda", reason: "営業職の求人が最も多い", affiliate: true },
      { key: "neo_career_agent", name: "第二新卒エージェントneo", reason: "第二新卒の営業転職に特化したサポート", affiliate: false, url: "https://www.daini-agent.jp/" },
    ],
  },
  pm: {
    label: "ディレクター・PM系（調整・進行型）",
    emoji: "🗂",
    description:
      "全体を俯瞰して段取りを組み、チームをまとめることが得意なタイプです。Webディレクターやプロジェクトマネージャーは、技術とビジネスの橋渡し役。未経験から目指す場合は、まずアシスタントディレクターやIT企業の企画職から入るルートが現実的です。",
    articles: [
      { slug: "web-industry-guide", title: "未経験からWeb業界を目指す人のための業界ガイド" },
      { slug: "second-new-grad-it-career-change", title: "第二新卒がIT/Web業界へ転職する完全ガイド" },
    ],
    agents: [
      { key: "doda", name: "doda", reason: "ディレクター求人を幅広くカバー", affiliate: true },
      { key: "neo_career_agent", name: "第二新卒エージェントneo", reason: "未経験からのディレクター転職を相談可能", affiliate: false, url: "https://www.daini-agent.jp/" },
    ],
  },
};

// --- Questions ---

type JobQuestion = {
  text: string;
  options: { label: string; type: JobType }[];
};

type CultureQuestion = {
  text: string;
  options: [
    { label: string; venture: number },
    { label: string; venture: number },
  ];
};

const JOB_QUESTIONS: JobQuestion[] = [
  {
    text: "仕事で一番テンションが上がる瞬間は？",
    options: [
      { label: "自分が作ったものが動いたとき", type: "engineer" },
      { label: "データから新しい発見があったとき", type: "marketer" },
      { label: "お客さんから「ありがとう」と言われたとき", type: "cs" },
      { label: "目標の数字を達成したとき", type: "sales" },
      { label: "チームがうまく回って成果が出たとき", type: "pm" },
    ],
  },
  {
    text: "休日にやりがちなことは？",
    options: [
      { label: "新しいツールやアプリを試す", type: "engineer" },
      { label: "SNSやトレンドをチェックする", type: "marketer" },
      { label: "友人の相談に乗る・話を聞く", type: "cs" },
      { label: "人と会う予定を入れる", type: "sales" },
      { label: "旅行やイベントの計画を立てる", type: "pm" },
    ],
  },
  {
    text: "グループワークで自然と担いがちな役割は？",
    options: [
      { label: "資料やスライドを作る担当", type: "engineer" },
      { label: "情報を集めて整理する担当", type: "marketer" },
      { label: "メンバーの意見を聞いてまとめる担当", type: "cs" },
      { label: "発表やプレゼンを担当する", type: "sales" },
      { label: "全体のスケジュールを管理する", type: "pm" },
    ],
  },
  {
    text: "「すごい」と思う人のタイプは？",
    options: [
      { label: "ゼロからプロダクトを作れる人", type: "engineer" },
      { label: "数字の裏にあるストーリーを読み解ける人", type: "marketer" },
      { label: "誰とでも信頼関係を築ける人", type: "cs" },
      { label: "どんな相手にも臆せず交渉できる人", type: "sales" },
      { label: "複雑なプロジェクトを涼しい顔で回す人", type: "pm" },
    ],
  },
  {
    text: "転職先で一番重視したいことは？",
    options: [
      { label: "技術力が身につく環境", type: "engineer" },
      { label: "施策の裁量権がある環境", type: "marketer" },
      { label: "チームワークを大切にする文化", type: "cs" },
      { label: "成果が収入に直結する仕組み", type: "sales" },
      { label: "多様な職種と関われるポジション", type: "pm" },
    ],
  },
  {
    text: "仕事でストレスを感じるのは？",
    options: [
      { label: "自分で手を動かせない状況", type: "engineer" },
      { label: "効果測定ができない仕事", type: "marketer" },
      { label: "人間関係がギスギスしている環境", type: "cs" },
      { label: "ノルマがなくダラダラ過ぎる日々", type: "sales" },
      { label: "段取りが悪くて無駄が多い仕事", type: "pm" },
    ],
  },
];

const CULTURE_QUESTIONS: CultureQuestion[] = [
  {
    text: "どちらの環境が自分に合いそう？",
    options: [
      { label: "整った研修制度・マニュアルがある環境", venture: 0 },
      { label: "手探りでも自分で考えて動ける環境", venture: 1 },
    ],
  },
  {
    text: "給与体系はどちらが魅力的？",
    options: [
      { label: "安定した固定給＋年功序列の昇給", venture: 0 },
      { label: "成果次第で大きく上がるインセンティブ制", venture: 1 },
    ],
  },
  {
    text: "入社1年目に求めるものは？",
    options: [
      { label: "丁寧に教えてもらえる先輩・上司", venture: 0 },
      { label: "すぐに実践で任せてもらえる裁量", venture: 1 },
    ],
  },
  {
    text: "会社の規模感はどちらが気になる？",
    options: [
      { label: "名前を言えば伝わる大手・安定企業", venture: 0 },
      { label: "少人数で一人ひとりの影響が大きいスタートアップ", venture: 1 },
    ],
  },
];

const TOTAL_QUESTIONS = JOB_QUESTIONS.length + CULTURE_QUESTIONS.length;

// --- Component ---

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function DiagnosisTool() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if we have results in URL
  const resultType = searchParams.get("type") as JobType | null;
  const resultVenture = searchParams.get("v");

  if (resultType && resultVenture && JOB_TYPES[resultType]) {
    return (
      <DiagnosisResult
        jobType={resultType}
        venturePercent={parseInt(resultVenture, 10)}
      />
    );
  }

  return <DiagnosisQuiz onComplete={(type, venture) => {
    router.push(`/diagnosis?type=${type}&v=${venture}`, { scroll: false });
  }} />;
}

function DiagnosisQuiz({ onComplete }: { onComplete: (type: JobType, venture: number) => void }) {
  const [step, setStep] = useState(0);
  const [jobScores, setJobScores] = useState<Record<JobType, number>>({
    engineer: 0, marketer: 0, cs: 0, sales: 0, pm: 0,
  });
  const [ventureScore, setVentureScore] = useState(0);

  const isJobPhase = step < JOB_QUESTIONS.length;
  const cultureIndex = step - JOB_QUESTIONS.length;
  const progress = ((step) / TOTAL_QUESTIONS) * 100;

  const handleJobAnswer = useCallback((type: JobType) => {
    setJobScores(prev => ({ ...prev, [type]: prev[type] + 1 }));
    if (step + 1 < TOTAL_QUESTIONS) {
      setStep(s => s + 1);
    }
  }, [step]);

  const handleCultureAnswer = useCallback((venture: number) => {
    const newVenture = ventureScore + venture;

    if (step + 1 >= TOTAL_QUESTIONS) {
      // Calculate results
      const finalScores = { ...jobScores };
      const topType = (Object.entries(finalScores) as [JobType, number][])
        .sort((a, b) => b[1] - a[1])[0][0];
      const venturePercent = Math.round((newVenture / CULTURE_QUESTIONS.length) * 100);

      // Track event
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "diagnosis_complete",
        diagnosis_type: topType,
        diagnosis_venture: venturePercent,
      });

      onComplete(topType, venturePercent);
    } else {
      setVentureScore(newVenture);
      setStep(s => s + 1);
    }
  }, [step, jobScores, ventureScore, onComplete]);

  const currentQuestion = isJobPhase
    ? JOB_QUESTIONS[step]
    : CULTURE_QUESTIONS[cultureIndex];

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-ink-soft font-mono mb-2">
          <span>Q{step + 1} / {TOTAL_QUESTIONS}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-line rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase indicator */}
      <p className="text-xs font-mono text-ink-soft mb-2">
        {isJobPhase ? "STEP 1: 職種タイプ診断" : "STEP 2: 社風の傾向"}
      </p>

      {/* Question */}
      <h3 className="text-lg font-bold mb-6">{currentQuestion.text}</h3>

      {/* Options */}
      <div className="space-y-3">
        {currentQuestion.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => {
              if (isJobPhase) {
                handleJobAnswer((opt as { type: JobType }).type);
              } else {
                handleCultureAnswer((opt as { venture: number }).venture);
              }
            }}
            className="w-full text-left px-5 py-4 rounded-lg border border-line bg-white hover:border-accent hover:bg-accent-soft transition-all duration-150 text-sm leading-relaxed"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DiagnosisResult({ jobType, venturePercent }: { jobType: JobType; venturePercent: number }) {
  const info = JOB_TYPES[jobType];
  const stablePercent = 100 - venturePercent;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com";
  const shareUrl = `${baseUrl}/diagnosis?type=${jobType}&v=${venturePercent}`;
  const shareText = `適職診断の結果は「${info.label}」でした！（ベンチャー寄り${venturePercent}%）`;

  return (
    <div>
      {/* Result header */}
      <div className="text-center mb-8">
        <p className="text-xs font-mono text-ink-soft mb-2">あなたの診断結果</p>
        <p className="text-4xl mb-3">{info.emoji}</p>
        <h3 className="text-xl font-bold text-ink">{info.label}</h3>
      </div>

      {/* Culture bar */}
      <div className="bg-bg-soft rounded-lg p-5 mb-8">
        <p className="text-sm font-bold mb-3">社風の傾向</p>
        <div className="flex items-center justify-between text-xs font-mono text-ink-soft mb-2">
          <span>安定・大手寄り {stablePercent}%</span>
          <span>裁量・ベンチャー寄り {venturePercent}%</span>
        </div>
        <div className="h-3 bg-line rounded-full overflow-hidden flex">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${stablePercent}%` }}
          />
          <div
            className="h-full bg-amber transition-all duration-500"
            style={{ width: `${venturePercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-ink-soft mt-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-accent" />安定
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber" />ベンチャー
          </span>
        </div>
      </div>

      {/* Type description */}
      <div className="mb-8">
        <h4 className="text-sm font-bold mb-3">タイプ解説</h4>
        <p className="text-sm text-ink-soft leading-relaxed">{info.description}</p>
      </div>

      {/* Recommended articles */}
      {info.articles.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm font-bold mb-3">このタイプにおすすめの記事</h4>
          <div className="space-y-2">
            {info.articles.map((a) => (
              <Link
                key={a.slug}
                href={`/articles/${a.slug}`}
                className="block px-4 py-3 rounded-lg border border-line hover:border-accent hover:bg-accent-soft transition-colors text-sm text-ink font-medium"
              >
                {a.title} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recommended agents */}
      {info.agents.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm font-bold mb-3">このタイプにおすすめのエージェント</h4>

          {/* PR表記（affiliate案件が含まれる場合） */}
          {info.agents.some((a) => a.affiliate) && (
            <div className="bg-bg-soft border border-line rounded-lg px-3 py-2 mb-3">
              <p className="text-[11px] text-ink-soft leading-relaxed">
                {info.agents.some((a) => !a.affiliate)
                  ? "本ページの一部リンクはプロモーションを含みます。広告を含まないリンクと区別せず掲載していますが、紹介内容・評価はいずれも公平に記載しています。"
                  : "本ページはプロモーションを含みます。"}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {info.agents.map((agent) => (
              <div key={agent.key} className="border border-line rounded-lg p-4">
                <p className="font-bold text-sm">{agent.name}</p>
                <p className="text-xs text-ink-soft mt-1">{agent.reason}</p>
                {agent.url ? (
                  <a
                    href={agent.url}
                    target="_blank"
                    rel={agent.affiliate ? "nofollow sponsored" : "nofollow"}
                    className="cta-button mt-3 text-sm !px-5 !py-2.5"
                  >
                    {agent.affiliate ? "無料相談してみる" : "公式サイトを見る"}
                  </a>
                ) : (
                  <span className="inline-block mt-3 text-sm text-ink-soft px-5 py-2.5 bg-line rounded-lg">
                    準備中
                  </span>
                )}
                {agent.affiliate && (
                  <p className="text-[10px] text-ink-soft mt-2">※提携先のサービスです</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share */}
      <div className="border-t border-line pt-6">
        <p className="text-sm font-bold mb-3">診断結果をシェアする</p>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink/80 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Xでシェア
        </a>
      </div>

      {/* Retry */}
      <div className="mt-6">
        <Link
          href="/diagnosis"
          className="text-sm text-accent hover:underline"
        >
          もう一度診断する →
        </Link>
      </div>
    </div>
  );
}
