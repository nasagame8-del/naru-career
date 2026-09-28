/** Four preference axes, five items each. Reverse-worded items avoid a yes-only bias. */
export type PreferenceAxis = "initiative" | "focus" | "judgment" | "pace";
export interface MatchQuestion { text: string; axis: PreferenceAxis; yesIsPositive: boolean }
export const MATCH_QUESTIONS: readonly MatchQuestion[] = [
  { text: "新しいチームでは、自分から声をかけることが多い。", axis: "initiative", yesIsPositive: true },
  { text: "まだ誰も試していないアイデアを考えると、ワクワクする。", axis: "focus", yesIsPositive: true },
  { text: "迷ったときは、気持ちよりも事実やデータを整理したい。", axis: "judgment", yesIsPositive: true },
  { text: "予定をきっちり決めるより、その場で動くほうが好きだ。", axis: "pace", yesIsPositive: true },
  { text: "先頭に立つより、仲間の動きを支えるほうが得意だ。", axis: "initiative", yesIsPositive: false },
  { text: "新しい方法を探すより、確かなやり方を磨きたい。", axis: "focus", yesIsPositive: false },
  { text: "効率が少し落ちても、みんなの納得を大切にしたい。", axis: "judgment", yesIsPositive: false },
  { text: "取りかかる前に、手順やゴールを決めておきたい。", axis: "pace", yesIsPositive: false },
  { text: "意見が分かれたとき、自分から方向性を提案する。", axis: "initiative", yesIsPositive: true },
  { text: "目の前の作業より、その先の可能性を想像するのが好きだ。", axis: "focus", yesIsPositive: true },
  { text: "問題が起きたら、まず原因と解決策を考える。", axis: "judgment", yesIsPositive: true },
  { text: "途中でもっと良い方法を思いついたら、計画を変えたい。", axis: "pace", yesIsPositive: true },
  { text: "自分が目立つことより、誰かの役に立つことがうれしい。", axis: "initiative", yesIsPositive: false },
  { text: "抽象的な話より、実際に手を動かして学びたい。", axis: "focus", yesIsPositive: false },
  { text: "相談されたら、解決策より先に気持ちを受け止めたい。", axis: "judgment", yesIsPositive: false },
  { text: "自由に進めるより、締め切りや役割が明確なほうが安心する。", axis: "pace", yesIsPositive: false },
  { text: "やってみたいことがあれば、周りを誘って動き始める。", axis: "initiative", yesIsPositive: true },
  { text: "今ある仕組みを、まったく違うものに変えてみたい。", axis: "focus", yesIsPositive: true },
  { text: "大切な判断では、筋が通っているかを重視する。", axis: "judgment", yesIsPositive: true },
  { text: "予想外の出来事も、新しいチャンスとして楽しめる。", axis: "pace", yesIsPositive: true },
];

// Bit order: initiative, focus, judgment, pace. Every combination has one class.
const CLASS_BY_PROFILE = [10, 16, 7, 11, 4, 6, 15, 3, 12, 14, 2, 9, 8, 1, 13, 5] as const;
const AXES: PreferenceAxis[] = ["initiative", "focus", "judgment", "pace"];
export function diagnose(answers: readonly boolean[]): number {
  if (answers.length !== MATCH_QUESTIONS.length || answers.some(answer => typeof answer !== "boolean")) {
    throw new Error("A diagnosis requires exactly 20 yes/no answers.");
  }
  const totals: Record<PreferenceAxis, number> = { initiative: 0, focus: 0, judgment: 0, pace: 0 };
  MATCH_QUESTIONS.forEach((question, index) => {
    if (answers[index] === question.yesIsPositive) totals[question.axis]++;
  });
  const profile = AXES.reduce((value, axis) => value * 2 + Number(totals[axis] >= 3), 0);
  return CLASS_BY_PROFILE[profile];
}

export const RESULT_HEADLINES: Record<number, readonly [string, string]> = {
  1: ["ひらめきで、", "新しい世界をつくれ！"],
  2: ["仲間を率いて、", "未来を切りひらけ！"],
  3: ["知識を力に、", "答えを見つけよう！"],
  4: ["その優しさで、", "仲間を支えよう！"],
  5: ["発想を掛け合わせ、", "可能性を生み出せ！"],
  6: ["心を動かす、", "物語を届けよう！"],
  7: ["そのこだわりで、", "世界をつくり込め！"],
  8: ["大きな野望で、", "常識を塗りかえろ！"],
  9: ["チャンスを見抜き、", "新しい道を探せ！"],
  10: ["揺るがぬ信頼で、", "仲間を守り抜け！"],
  11: ["鋭い視点で、", "核心をつかめ！"],
  12: ["信じた道を、", "まっすぐ進め！"],
  13: ["先を見通し、", "勝利への道を描け！"],
  14: ["知らない世界へ、", "最初の一歩を！"],
  15: ["隠れた本質を、", "深く解き明かせ！"],
  16: ["人とつながり、", "心地よい場所を育てよう！"],
};
