"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TYPES16 } from "./_lib/data";
import { diagnose, MATCH_QUESTIONS } from "./_lib/matching";
import { trackEvent } from "./_lib/analytics";
import ResultContent from "./_components/ResultContent";
import QuestCharacter from "./_components/QuestCharacter";

type Screen = "title" | "quiz" | "matching" | "result" | "types";
const asset = (name: string) => `/shindan/rpg/${name}.webp`;
export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<boolean | null>(null);
  const [resultTypeId, setResultTypeId] = useState(1);
  const [busy, setBusy] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    for (const name of ["guild", "guide"]) { const image = new window.Image(); image.src = asset(name); }
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [screen, qIndex]);
  function delay(callback: () => void, duration: number) {
    if (timer.current) clearTimeout(timer.current);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(callback, reducedMotion || motionPaused ? 0 : duration);
  }
  function unlock() { setSelected(null); setBusy(false); locked.current = false; }
  function showTitle() {
    if (timer.current) clearTimeout(timer.current);
    unlock(); setAnswers([]); setQIndex(0); setScreen("title");
  }
  function start() {
    if (locked.current) return;
    for (const name of ["laboratory", "crystal", "world", "portraits"]) {
      const image = new window.Image(); image.src = asset(name);
    }
    setAnswers([]); setQIndex(0); setSelected(null); setScreen("quiz");
  }
  function answer(value: boolean) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setSelected(value);
    if (qIndex === 0) trackEvent("quiz_start");
    const next = [...answers, value];
    setAnswers(next);
    delay(() => {
      if (next.length === MATCH_QUESTIONS.length) {
        const id = diagnose(next);
        setResultTypeId(id);
        trackEvent("quiz_complete", { type: TYPES16[id].name });
        setScreen("matching");
        delay(() => { setScreen("result"); unlock(); }, 900);
      } else { setQIndex(qIndex + 1); unlock(); }
    }, 180);
  }
  const backdrop = screen === "quiz" || screen === "types" ? "guild" : screen === "matching" ? "laboratory" : "world";
  return <div className={`stage rpg-stage screen-${screen} ${motionPaused ? "motion-paused" : ""}`}>
    <Image className="rpg-backdrop" src={asset(backdrop)} alt="" fill sizes="100vw" preload unoptimized />
    <header className="rpg-header">
      <Link href="/" className="rpg-brand" aria-label="NARU トップへ">NARU <span>第二新卒×IT/Web転職メディア</span></Link>
      <div className="rpg-header-actions">
        {screen !== "title" && <button onClick={showTitle} disabled={busy}>診断トップ</button>}
        <button onClick={() => setMotionPaused(!motionPaused)} aria-pressed={motionPaused}>{motionPaused ? "演出を再生" : "演出を停止"}</button>
      </div>
    </header>
    {screen === "title" && <section className="rpg-title" aria-label="適職診断タイトル">
      <div className="rpg-title-paper paper">
        <Image className="title-compass" src={asset("compass")} width={110} height={110} alt="" unoptimized />
        <p className="rpg-eyebrow">CAREER QUEST</p>
        <h1 ref={heading} tabIndex={-1}>適職診断</h1>
        <p>キミの強みから、<br />本当に向いている仕事を見つけよう</p>
      </div>
      <nav className="rpg-signs" aria-label="冒険メニュー">
        <button onClick={() => setScreen("types")}>16タイプを知る</button>
        <button onClick={start}>強みを見つける</button>
        <Link href="/articles">キャリアの地図を描く</Link>
      </nav>
      <div className="rpg-facts paper"><span>全20問<small>（約2分）</small></span><span>登録不要</span><span>16タイプ診断</span></div>
      <button className="rpg-command rpg-start" onClick={start}><Image src={asset("compass")} alt="" width={100} height={100} unoptimized />冒険をはじめる<span aria-hidden="true">›</span></button>
      <p className="rpg-disclaimer">自己理解のヒントを楽しむための診断です。</p>
    </section>}
    {screen === "quiz" && <section className="rpg-quiz" aria-label="質問">
      <div className="rpg-progress"><p>QUEST {String(qIndex + 1).padStart(2,"0")} / {MATCH_QUESTIONS.length}</p><div role="progressbar" aria-label="回答済みの質問" aria-valuemin={0} aria-valuemax={20} aria-valuenow={answers.length}><span style={{width:`${answers.length * 5}%`}} /></div></div>
      <div className={`rpg-question paper ${selected !== null ? "is-answered" : ""}`} key={qIndex}>
        <h1 ref={heading} tabIndex={-1}>{MATCH_QUESTIONS[qIndex].text}</h1>
      </div>
      <Image className="rpg-guide" src={asset("guide")} alt="地図を手にした冒険者" width={768} height={512} unoptimized />
      <div className="rpg-answers" aria-label="質問への回答"><button className="rpg-command" onClick={() => answer(true)} disabled={busy}>はい<span aria-hidden="true">›</span></button><button className="rpg-command" onClick={() => answer(false)} disabled={busy}>いいえ<span aria-hidden="true">›</span></button></div>
      <div className="rpg-dialogue paper"><p>キミの考え方や行動のクセから、<br />向いている仕事のヒントを見つけていくよ！</p><small>正解はありません。直感で選んでね。</small></div>
    </section>}
    {screen === "matching" && <section className="rpg-matching" aria-label="診断結果を準備しています"><div role="status"><h1 ref={heading} tabIndex={-1}>キミの特性を分析中…</h1><p>これまでの回答から、<br />キミの強みや価値観を整理しています</p><ul><li>価値観の傾向を分析中…</li><li>行動特性を分析中…</li><li>向いている職種を照合中…</li></ul></div><Image className="rpg-crystal" src={asset("crystal")} alt="" width={300} height={300} unoptimized /></section>}
    {screen === "result" && <section id="result-screen"><ResultContent typeId={resultTypeId} typeInfo={TYPES16[resultTypeId]} onRetry={showTitle} /></section>}
    {screen === "types" && <section className="rpg-archive paper"><h1 ref={heading} tabIndex={-1}>16タイプの仲間たち</h1><p>それぞれの強みや特徴を見てみよう</p><div className="rpg-types-grid">{Object.entries(TYPES16).map(([id,type])=><Link href={`/types/${type.slug}`} key={id} className="rpg-type"><QuestCharacter id={Number(id)} /><h2>{type.name.split("（")[0]}</h2><span>{type.name.split("（")[1]?.replace("）","")}</span></Link>)}</div><button className="rpg-command" onClick={start}>自分のタイプを診断する<span aria-hidden="true">›</span></button></section>}
  </div>;
}
