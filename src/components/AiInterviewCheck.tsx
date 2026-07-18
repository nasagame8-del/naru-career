"use client";

import { useState } from "react";
import Link from "next/link";

type Question = {
  text: string;
  options: { label: string; aware: boolean }[];
  insight: string;
};

const QUESTIONS: Question[] = [
  {
    text: "AI面接中、カメラの位置はどこを意識しますか？",
    options: [
      { label: "画面に映る自分の顔を見ながら話す", aware: false },
      { label: "カメラのレンズを見て話す", aware: true },
    ],
    insight: "AIは「目線がカメラに向いているか」を分析しています。画面の自分を見ると、AI側には目線が下にずれて映ります。カメラのレンズを見ることが「面接官の目を見る」に相当します。",
  },
  {
    text: "AI面接で回答するとき、一つの質問にどのくらい話しますか？",
    options: [
      { label: "思いついたことをすべて伝えたいので、3分以上話すこともある", aware: false },
      { label: "結論から先に言って、1〜2分以内にまとめる", aware: true },
    ],
    insight: "AIは回答の構造（結論→理由→具体例）を分析しています。長く話すほど評価が上がるわけではなく、「結論ファーストで簡潔に話す」方がスコアが高くなる傾向があります。",
  },
  {
    text: "AI面接の録画中に沈黙が生まれたら、どうしますか？",
    options: [
      { label: "何か話さなきゃと焦って、考えがまとまらないまま話し始める", aware: false },
      { label: "「少し考えさせてください」と言ってから、2〜3秒整理して話す", aware: true },
    ],
    insight: "AIは極端に長い沈黙や、まとまりのない発言をネガティブに評価することがあります。ただし「考える時間」を宣言してからの短い間は問題ありません。焦って支離滅裂になるより、一呼吸おく方が評価は安定します。",
  },
  {
    text: "AI面接の前に、どんな準備をしますか？",
    options: [
      { label: "特に何もせず、本番で考えながら答える", aware: false },
      { label: "よくある質問への回答を声に出して練習しておく", aware: true },
    ],
    insight: "AI面接では「声のトーン」「表情の変化」「言い淀みの少なさ」も分析対象です。頭の中で考えるだけでなく、実際に声に出して練習しておくと、本番での表現が自然になります。",
  },
];

export function AiInterviewCheck() {
  const [step, setStep] = useState(-1); // -1=start, 0-3=questions, 4=result
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [selected, setSelected] = useState<boolean | null>(null);

  const handleStart = () => setStep(0);

  const handleNext = () => {
    if (selected === null) return;
    setAnswers([...answers, selected]);
    setSelected(null);
    setStep(step + 1);
  };

  const handleRestart = () => {
    setStep(-1);
    setAnswers([]);
    setSelected(null);
  };

  // Start screen
  if (step === -1) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-ink mb-3">AI面接の準備、できてる？</h2>
        <p className="text-sm text-ink-soft leading-relaxed mb-6">
          4つの質問で、AI面接で見られているポイントを<br />
          あなたがどのくらい把握しているかチェックします。
        </p>
        <div className="space-y-2 mb-6 text-left max-w-xs mx-auto">
          <p className="flex items-center gap-2 text-sm text-ink">
            <span className="text-accent">&#10003;</span> 4問・約1分で完了
          </p>
          <p className="flex items-center gap-2 text-sm text-ink">
            <span className="text-accent">&#10003;</span> 各問にAI面接の評価ポイント解説つき
          </p>
          <p className="flex items-center gap-2 text-sm text-ink">
            <span className="text-accent">&#10003;</span> 登録不要・完全無料
          </p>
        </div>
        <button onClick={handleStart} className="w-full max-w-xs bg-accent text-white font-bold py-3.5 rounded-full text-[15px] hover:bg-accent/90 transition-colors">
          チェックを始める
        </button>
      </div>
    );
  }

  // Result screen
  if (step >= QUESTIONS.length) {
    const awareCount = answers.filter(Boolean).length;
    return (
      <div>
        <div className="text-center mb-6">
          <p className="text-xs text-ink-soft mb-2">あなたの結果</p>
          <div className="bg-accent-soft rounded-2xl px-6 py-6">
            <p className="text-3xl font-bold text-accent">{awareCount} / {QUESTIONS.length}</p>
            <p className="text-sm text-ink-soft mt-1">AI面接の評価ポイントを把握済み</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <h3 className="font-bold text-sm text-ink">各ポイントの解説</h3>
          {QUESTIONS.map((q, i) => (
            <div key={i} className={`rounded-lg border p-4 ${answers[i] ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}`}>
              <p className="text-xs font-bold mb-1 flex items-center gap-1.5">
                <span className={answers[i] ? "text-green-600" : "text-amber"}>
                  {answers[i] ? "&#10003; 把握済み" : "&#9888; 要確認"}
                </span>
              </p>
              <p className="text-[13px] text-ink-soft leading-relaxed">{q.insight}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 mb-6">
          <h3 className="font-bold text-sm text-ink mb-2">関連記事</h3>
          <Link href="/articles/ai-interview-screening" className="block px-4 py-3 rounded-lg border border-line hover:border-accent hover:bg-accent-soft transition-colors text-sm text-ink font-medium">
            AI面接・適性検査とは？採用側のAI活用を知れば対策が見える →
          </Link>
          <Link href="/articles/interview-failure-why-this-job" className="block px-4 py-3 rounded-lg border border-line hover:border-accent hover:bg-accent-soft transition-colors text-sm text-ink font-medium">
            面接で「なぜこの職種を志望するのか」と聞かれて詰まった話 →
          </Link>
          <Link href="/articles/casual-interview" className="block px-4 py-3 rounded-lg border border-line hover:border-accent hover:bg-accent-soft transition-colors text-sm text-ink font-medium">
            カジュアル面談とは？本選考の面接との違い →
          </Link>
        </div>

        <button onClick={handleRestart} className="w-full py-3 rounded-full border border-line text-ink font-bold text-sm hover:bg-bg-soft transition-colors">
          もう一度チェックする
        </button>
      </div>
    );
  }

  // Question screen
  const q = QUESTIONS[step];
  const progress = ((step + 1) / QUESTIONS.length) * 100;

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[13px] font-bold text-ink-soft">Q.{String(step + 1).padStart(2, "0")} / {QUESTIONS.length}</span>
          <span className="text-[12px] text-ink-soft">{Math.round(progress)}%</span>
        </div>
        <div className="h-[5px] bg-bg-soft rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <h3 className="text-[17px] font-bold mb-6 leading-snug">{q.text}</h3>

      <div className="space-y-3 mb-8">
        {q.options.map((opt, i) => (
          <button key={i} onClick={() => setSelected(opt.aware)}
            className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-all flex items-center gap-3 ${
              selected === opt.aware ? "border-accent bg-accent-soft" : "border-line bg-white hover:border-accent/40"
            }`}>
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              selected === opt.aware ? "border-accent bg-accent" : "border-line"
            }`}>
              {selected === opt.aware && <span className="block w-2 h-2 rounded-full bg-white" />}
            </span>
            <span className="text-[13px] text-ink leading-relaxed">{opt.label}</span>
          </button>
        ))}
      </div>

      <button onClick={handleNext} disabled={selected === null}
        className={`w-full py-3.5 rounded-full font-bold text-[13px] transition-colors ${
          selected !== null ? "bg-accent text-white hover:bg-accent/90" : "bg-bg-soft text-ink-soft/50 cursor-not-allowed"
        }`}>
        {step + 1 >= QUESTIONS.length ? "結果を見る" : "次の質問へ"}
      </button>
    </div>
  );
}
