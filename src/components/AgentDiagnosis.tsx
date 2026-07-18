"use client";

import { useState } from "react";
import Image from "next/image";

// ────────────────────────────────────────
// Data
// ────────────────────────────────────────

type Route = "shinsotsu" | "daini";
type AgentFeature = { title: string; desc: string };
type AgentInfo = { key: string; name: string; affiliate: boolean; url: string; ctaText: string; features: AgentFeature[] };

const AGENTS: Record<string, AgentInfo> = {
  doda: { key: "doda", name: "doda", affiliate: true, url: "", ctaText: "dodaで求人を探してみる", features: [
    { title: "求人数が業界トップクラス", desc: "10万件以上の求人からあなたに合う企業を検索できます" },
    { title: "アプリが使いやすい", desc: "求人検索・応募管理がスマホで完結するUI設計" },
    { title: "エージェント併用も可能", desc: "自分で探す＋プロに紹介してもらう、両方のスタイルに対応" },
  ]},
  neo_career_agent: { key: "neo_career_agent", name: "第二新卒エージェントneo", affiliate: false, url: "https://www.daini-agent.jp/", ctaText: "公式サイトを見る", features: [
    { title: "20代特化のサポート", desc: "第二新卒・既卒・フリーターの転職支援に特化した実績22,500人超" },
    { title: "親身なカウンセリング", desc: "一人ひとりの状況に合わせた丁寧な面談とアドバイス" },
    { title: "書類・面接対策が充実", desc: "履歴書の添削から模擬面接まで手厚くサポート" },
  ]},
  mynavi_shinsotsu: { key: "mynavi_shinsotsu", name: "マイナビ新卒紹介", affiliate: true, url: "", ctaText: "無料相談してみる", features: [
    { title: "大手企業の非公開求人", desc: "マイナビだけが持つ非公開求人にアクセスできます" },
    { title: "専任アドバイザー制", desc: "一人ひとりに専任のアドバイザーがつき、ES添削から面接対策まで" },
    { title: "適性診断つき", desc: "自分の強みや適職を客観的に把握できる診断ツールを提供" },
  ]},
  doda_campus: { key: "doda_campus", name: "dodaキャンパス", affiliate: true, url: "", ctaText: "無料登録してみる", features: [
    { title: "企業からオファーが届く", desc: "プロフィールを見た企業から直接スカウトが届くスタイル" },
    { title: "キャリア学習コンテンツ", desc: "就活準備に役立つ講座やイベントが充実" },
    { title: "ベネッセ×パーソル運営", desc: "教育大手とHR大手のノウハウを融合した信頼性" },
  ]},
  offerbox: { key: "offerbox", name: "OfferBox", affiliate: true, url: "", ctaText: "無料登録してみる", features: [
    { title: "企業からのスカウト型", desc: "自分のプロフィールを見た企業からオファーが届きます" },
    { title: "利用企業数1万社以上", desc: "大手からベンチャーまで幅広い企業が登録" },
    { title: "自己PR重視", desc: "学歴よりも「あなたらしさ」が評価される仕組み" },
  ]},
  career_ticket: { key: "career_ticket", name: "キャリアチケット", affiliate: true, url: "", ctaText: "無料相談してみる", features: [
    { title: "最短2週間で内定", desc: "スピード重視の就活サポートで早期内定を実現" },
    { title: "量より質のマッチング", desc: "厳選した企業のみを紹介し、入社後のミスマッチを防止" },
    { title: "自己分析サポート", desc: "強みの言語化から志望動機の作成までトータルに支援" },
  ]},
  neo_career_shinsotsu: { key: "neo_career_shinsotsu", name: "就職エージェントneo", affiliate: false, url: "https://www.s-agent.jp/", ctaText: "公式サイトを見る", features: [
    { title: "新卒就活に特化", desc: "新卒の就職活動に特化したカウンセリングと求人紹介" },
    { title: "親身な個別サポート", desc: "一人ひとりの希望・適性に合わせた丁寧な面談" },
    { title: "選考対策が手厚い", desc: "ES添削・面接練習など内定獲得まで伴走するサポート体制" },
  ]},
};

type ScoreMap = Record<string, number>;
const Q1S: Record<string, ScoreMap> = { search: { doda: 3, doda_campus: 3 }, agent: { neo_career_agent: 3, mynavi_shinsotsu: 3, career_ticket: 3, neo_career_shinsotsu: 3 }, scout: { offerbox: 3 } };
const Q2S: Record<string, ScoreMap> = { speed: { career_ticket: 2, doda: 1 }, support: { neo_career_agent: 2, mynavi_shinsotsu: 2, neo_career_shinsotsu: 2 }, specialty: { doda: 2, neo_career_agent: 1 } };
const Q3S: Record<string, ScoreMap> = { active: { doda: 1, career_ticket: 1, neo_career_agent: 1 }, research: { offerbox: 1, doda_campus: 1 } };
const Q4S: Record<string, ScoreMap> = { frequent: { neo_career_agent: 1, mynavi_shinsotsu: 1, career_ticket: 1, neo_career_shinsotsu: 1 }, own_pace: { doda: 1, offerbox: 1, doda_campus: 1 } };
const SCORES = [Q1S, Q2S, Q3S, Q4S];

type Question = { id: string; text: string; illustration?: string; options: { label: string; value: string }[] };
const QUESTIONS: Question[] = [
  { id: "q1", text: "求人は自分で探したいですか？\nそれとも、プロに紹介してほしいですか？", illustration: "/images/diagnosis/hero-or.png", options: [
    { label: "自分で探して、条件を細かく絞りたい", value: "search" },
    { label: "プロに相談して、合う企業を紹介してほしい", value: "agent" },
    { label: "企業からのスカウトを待ちたい", value: "scout" },
  ]},
  { id: "q2", text: "転職・就活で一番重視することは？", illustration: "/images/diagnosis/q2-illust.png", options: [
    { label: "スピード重視（早く内定が欲しい）", value: "speed" },
    { label: "丁寧なサポート重視（じっくり相談したい）", value: "support" },
    { label: "業界の専門性重視（IT/Web業界に強いところ）", value: "specialty" },
  ]},
  { id: "q3", text: "今の転職・就活へのモチベーションは？", illustration: "/images/diagnosis/q1-illust.png", options: [
    { label: "早く動きたい、すぐにでも行動したい", value: "active" },
    { label: "まだ情報収集段階、焦らず考えたい", value: "research" },
  ]},
  { id: "q4", text: "サポートの頻度はどちらが好み？", illustration: "/images/diagnosis/q4-illust.png", options: [
    { label: "こまめに連絡が欲しい", value: "frequent" },
    { label: "自分のペースで進めたい", value: "own_pace" },
  ]},
];

const POOLS: Record<Route, string[]> = {
  shinsotsu: ["mynavi_shinsotsu", "doda_campus", "offerbox", "career_ticket", "neo_career_shinsotsu"],
  daini: ["doda", "neo_career_agent"],
};

// ────────────────────────────────────────
// Main
// ────────────────────────────────────────

export function DiagnosisApp() {
  const [phase, setPhase] = useState<"start" | "quiz" | "result">("start");
  const [route, setRoute] = useState<Route>("daini");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);

  const start = () => setPhase("quiz");
  const pickRoute = (r: Route) => { setRoute(r); setStep(1); };

  const next = () => {
    if (!sel) return;
    const a = [...answers, sel];
    setAnswers(a); setSel(null);
    if (step >= QUESTIONS.length) {
      const pool = POOLS[route];
      const sc: Record<string, number> = {}; pool.forEach(k => sc[k] = 0);
      a.forEach((ans, i) => { const m = SCORES[i]?.[ans]; if (m) Object.entries(m).forEach(([k, v]) => { if (pool.includes(k)) sc[k] += v; }); });
      const top = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]?.[0];
      const result = AGENTS[top] || AGENTS[pool[0]];
      setAgent(result); setPhase("result");
      // GTMイベント
      if (typeof window !== "undefined") {
        (window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer = (window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer || [];
        (window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer!.push({ event: "agent_diagnosis_complete", agent_name: result.name, agent_key: result.key, route });
      }
    } else setStep(step + 1);
  };

  const back = () => {
    if (step === 1) { setStep(0); setAnswers([]); setSel(null); }
    else if (step > 1) { setAnswers(answers.slice(0, -1)); setSel(null); setStep(step - 1); }
  };

  const restart = () => { setPhase("start"); setRoute("daini"); setStep(0); setAnswers([]); setSel(null); setAgent(null); };

  if (phase === "start") return <StartScreen onStart={start} />;
  if (phase === "result" && agent) return <ResultScreen agent={agent} onRestart={restart} />;
  if (step === 0) return <RouteScreen onSelect={pickRoute} />;
  return <QuizScreen step={step} total={QUESTIONS.length} q={QUESTIONS[step - 1]} sel={sel} onSel={setSel} onNext={next} onBack={back} />;
}

// ── Start Screen ──

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-[calc(100vh-48px-72px)] flex flex-col">
      {/* 背景ウェーブ画像 */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Image src="/images/diagnosis/bg-wave.png" alt="" fill className="object-cover opacity-40" />
      </div>

      <div className="max-w-[440px] mx-auto px-4 sm:px-6 pt-4 pb-6 flex-1 flex flex-col">
        {/* タイトルロゴ */}
        <div className="flex justify-center mb-2">
          <Image
            src="/images/diagnosis/title-clean.png"
            alt="あなたにぴったりの エージェント相性診断"
            width={500} height={250}
            className="w-full h-auto"
            priority
          />
        </div>

        {/* メインイラスト（思案する男性+吹き出し） — coverで人物を大きく */}
        <div className="w-full h-[220px] overflow-hidden mb-4">
          <Image
            src="/images/diagnosis/q1-illust.png"
            alt="転職について考える男性のイラスト"
            width={480} height={320}
            className="w-full h-full object-cover object-[center_25%]"
          />
        </div>

        {/* CTAボタン — 人物イラスト直下 */}
        <button
          onClick={onStart}
          className="w-full bg-accent text-white font-bold py-3.5 rounded-full text-[15px] hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 mb-5"
        >
          診断をスタートする
        </button>

        {/* 安心材料（HTML、全5問に修正） */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-4 mb-4">
          <div className="flex justify-between text-center">
            <div className="flex-1">
              <svg className="mx-auto mb-1.5 text-accent" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/><path d="M8 7l1 1 2-2" stroke="currentColor" strokeWidth="1.5"/></svg>
              <p className="text-[12px] font-bold text-ink">質問は全5問</p>
              <p className="text-[10px] text-ink-soft">約2〜3分で完了</p>
            </div>
            <div className="flex-1 border-x border-line/50">
              <svg className="mx-auto mb-1.5 text-accent" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <p className="text-[12px] font-bold text-ink">完全無料</p>
              <p className="text-[10px] text-ink-soft">登録不要</p>
            </div>
            <div className="flex-1">
              <svg className="mx-auto mb-1.5 text-accent" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/></svg>
              <p className="text-[12px] font-bold text-ink">個人情報の入力</p>
              <p className="text-[10px] text-ink-soft">は不要です</p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-ink-soft text-center">
          ※本診断は24社のうち7つのサービスを対象としています
        </p>
      </div>
    </div>
  );
}

// ── Route Screen (Q0) ──

function RouteScreen({ onSelect }: { onSelect: (r: Route) => void }) {
  return (
    <div className="max-w-[440px] mx-auto px-4 sm:px-6 pt-5 pb-6">
      <ProgressHeader step={0} total={5} />

      {/* Q0イラスト */}
      <div className="w-full h-[170px] overflow-hidden rounded-xl mb-4">
        <Image src="/images/diagnosis/q0-illust.png" alt="" width={400} height={260} className="w-full h-full object-cover object-[center_20%]" />
      </div>

      <h3 className="text-[17px] font-bold mb-1 leading-snug">今のあなたに近いのはどちらですか？</h3>
      <p className="text-[13px] text-ink-soft mb-5">回答によって、おすすめの候補が変わります</p>

      <div className="space-y-3">
        <button onClick={() => onSelect("shinsotsu")}
          className="w-full text-left px-5 py-4 rounded-2xl border border-line bg-white hover:border-accent transition-all flex items-center gap-4">
          <span className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5"/></svg>
          </span>
          <div><p className="font-bold text-[14px] text-ink">新卒（就活中）</p><p className="text-[11px] text-ink-soft mt-0.5">これから初めての就職活動をする方</p></div>
        </button>
        <button onClick={() => onSelect("daini")}
          className="w-full text-left px-5 py-4 rounded-2xl border border-line bg-white hover:border-accent transition-all flex items-center gap-4">
          <span className="w-10 h-10 rounded-full bg-amber-soft flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
          </span>
          <div><p className="font-bold text-[14px] text-ink">第二新卒（転職検討中）</p><p className="text-[11px] text-ink-soft mt-0.5">一度就職してから転職を考えている方</p></div>
        </button>
      </div>
    </div>
  );
}

// ── Progress Header (デザイン案準拠: 左にQ番号、右に数字、プログレスバー) ──

function ProgressHeader({ step, total }: { step: number; total: number }) {
  const pct = Math.max(4, (step / total) * 100);
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-bold text-ink-soft">
          Q.{String(step).padStart(2, "0")}
        </span>
        <span className="text-[12px] text-ink-soft">
          <span className="font-bold text-accent">{String(step).padStart(2, "0")}</span> / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div className="h-[5px] bg-bg-soft rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Quiz Screen (デザイン案準拠) ──

function QuizScreen({ step, total, q, sel, onSel, onNext, onBack }: {
  step: number; total: number; q: Question; sel: string | null;
  onSel: (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="max-w-[440px] mx-auto px-4 sm:px-6 pt-5 pb-6">
      <ProgressHeader step={step} total={total} />

      {/* イラスト（素材がある質問のみ） */}
      {q.illustration && (
        <div className="w-full h-[180px] overflow-hidden rounded-xl mb-4">
          <Image src={q.illustration} alt="" width={400} height={260} className="w-full h-full object-cover object-[center_25%]" />
        </div>
      )}

      <h3 className="text-[17px] font-bold mb-6 leading-snug whitespace-pre-line">{q.text}</h3>

      {/* 選択肢（デザイン案: 緑チェックマーク付きラジオ） */}
      <div className="space-y-3 mb-8">
        {q.options.map((opt) => {
          const active = sel === opt.value;
          return (
            <button key={opt.value} onClick={() => onSel(opt.value)}
              className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-all flex items-center gap-3 ${
                active ? "border-accent bg-accent-soft" : "border-line bg-white hover:border-accent/40"
              }`}>
              {/* ラジオドット */}
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                active ? "border-accent bg-accent" : "border-line"
              }`}>
                {active && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <span className="text-[13px] text-ink leading-relaxed">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* ナビゲーション（デザイン案: 左グレー「戻る」、右緑「次の質問へ」） */}
      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex-1 py-3 rounded-full border border-line text-ink-soft font-bold text-[13px] hover:bg-bg-soft transition-colors">
          戻る
        </button>
        <button onClick={onNext} disabled={!sel}
          className={`flex-1 py-3 rounded-full font-bold text-[13px] transition-colors ${
            sel ? "bg-accent text-white hover:bg-accent/90" : "bg-bg-soft text-ink-soft/50 cursor-not-allowed"
          }`}>
          {step >= total ? "結果を見る" : "次の質問へ"}
        </button>
      </div>
    </div>
  );
}

// ── Result Screen (デザイン案準拠) ──

function ResultScreen({ agent, onRestart }: { agent: AgentInfo; onRestart: () => void }) {
  return (
    <div className="max-w-[400px] mx-auto px-5 pt-5 pb-6">
      {/* PR表記 */}
      <div className="bg-bg-soft border border-line rounded-xl px-4 py-2.5 mb-6">
        <p className="text-[10px] text-ink-soft leading-relaxed">
          本ページの一部リンクはプロモーションを含みます。広告を含まないリンクと区別せず掲載していますが、紹介内容・評価はいずれも公平に記載しています。
        </p>
      </div>

      {/* 結果ヘッダー */}
      <div className="text-center mb-6">
        <p className="text-[12px] text-ink-soft mb-3">あなたに合うエージェントは...</p>
        <div className="bg-accent-soft rounded-2xl px-6 py-7">
          <p className="text-[11px] text-accent font-bold tracking-wider mb-1">あなたの診断結果</p>
          <h2 className="text-[24px] font-bold text-ink leading-tight">{agent.name}</h2>
        </div>
      </div>

      {/* おすすめの理由 */}
      <div className="border border-accent/20 rounded-2xl p-5 mb-6">
        <h4 className="text-[13px] font-bold text-accent mb-2">あなたにおすすめの理由</h4>
        <p className="text-[12px] text-ink-soft leading-relaxed">
          あなたの回答傾向から、{agent.name}のサービス特性が最もマッチしていると判定されました。以下の特徴があなたの転職・就職活動スタイルに合っています。
        </p>
      </div>

      {/* 特徴3点 */}
      <div className="space-y-4 mb-6">
        {agent.features.map((f, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className={`block w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white text-[11px] font-bold ${
              i === 0 ? "bg-accent" : i === 1 ? "bg-amber" : "bg-accent/60"
            }`}>{i + 1}</span>
            <div>
              <p className="font-bold text-[13px] text-ink">{f.title}</p>
              <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mb-3">
        {agent.url ? (
          <a href={agent.url} target="_blank" rel={agent.affiliate ? "nofollow sponsored" : "nofollow"}
            className="block w-full bg-accent text-white font-bold py-4 rounded-full text-center text-[14px] hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
            {agent.ctaText}
          </a>
        ) : (
          <span className="block w-full bg-bg-soft text-ink-soft font-bold py-4 rounded-full text-center text-[14px]">準備中</span>
        )}
        {agent.affiliate && <p className="text-[10px] text-ink-soft text-center mt-2">※提携先のサービスです</p>}
      </div>

      {/* 免責 */}
      <div className="bg-bg-soft rounded-xl p-4 mb-6">
        <p className="text-[10px] text-ink-soft leading-relaxed">
          ※診断結果は一例です。複数のエージェントを比較検討することをおすすめします。
        </p>
      </div>

      {/* シェア・やり直し */}
      <div className="border-t border-line pt-5 space-y-3">
        <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`エージェント相性診断の結果は「${agent.name}」でした！`)}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-ink text-white font-bold text-[13px] hover:bg-ink/80 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          Xでシェア
        </a>
        <button onClick={onRestart}
          className="w-full py-3 rounded-full border border-line text-ink font-bold text-[13px] hover:bg-bg-soft transition-colors">
          診断をやり直す
        </button>
      </div>
    </div>
  );
}
