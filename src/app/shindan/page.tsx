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
function QuestMap() {
 return <div className="quest-map" aria-hidden="true"><div className="map-orbit"><span>N</span><i /><i /><i /></div><svg className="map-route" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><path d="M-40 700 Q240 780 260 470 T600 270 T960 450 T1500 140" /><circle cx="260" cy="470" r="9" /><circle cx="600" cy="270" r="9" /><circle cx="960" cy="450" r="9" /></svg><span className="map-label map-label-one">THE LAND OF POSSIBILITY</span><span className="map-label map-label-two">YOUR NEXT CHAPTER</span></div>;
}
function FrameCorners() {
  return <span className="frame-corners" aria-hidden="true"><i /><i /><i /><i /></span>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [previousQuestion, setPreviousQuestion] = useState<number | null>(null);
  const [selected, setSelected] = useState<boolean | null>(null);
  const [resultTypeId, setResultTypeId] = useState(1);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

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
  function unlock() {
    setPreviousQuestion(null); setSelected(null); setBusy(false); locked.current = false;
  }
  function showTitle() {
    if (timer.current) clearTimeout(timer.current);
    unlock(); setStarting(false); setAnswers([]); setQIndex(0); setScreen("title");
  }
  function start() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setStarting(true);
    setAnswers([]); setQIndex(0); setSelected(null);
    delay(() => {
      setScreen("quiz"); setStarting(false);
      delay(unlock, 560);
    }, 320);
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
        delay(() => { setScreen("result"); unlock(); }, 2600);
      } else {
        setPreviousQuestion(qIndex); setQIndex(qIndex + 1); setSelected(null);
        delay(unlock, 560);
      }
    }, 140);
  }

  const onGameScreen = screen === "title" || screen === "quiz" || screen === "matching";
  return (
    <div className={`stage match-stage ${motionPaused ? "motion-paused" : ""} screen-${screen}`}>
      <header className="quest-header">
        <Link href="/" className="quest-brand" aria-label="NARU トップへ">NARU<span>CAREER<br />QUEST</span></Link>
        <span className="header-caption">自分を知る、小さな冒険。</span>
        <div className="header-actions">
          {screen !== "title" && <button onClick={showTitle} disabled={busy}>診断トップ</button>}
          <button className="motion-toggle" onClick={() => setMotionPaused(!motionPaused)} aria-pressed={motionPaused} aria-label={motionPaused ? "アニメーションを再生" : "アニメーションを停止"}>{motionPaused ? "▶" : "Ⅱ"}</button>
        </div>
      </header>
      {onGameScreen && <QuestMap />}

      {screen === "title" && <section id="title-screen" className={`screen match-title-screen ${starting ? "title-leaving" : ""}`}>
        <div className="title-lockup">
          <div className="lockup-top"><div className="title-intro"><p className="speech-label">あなたの「らしさ」が、冒険の武器になる！</p><p className="english-title">CAREER QUEST</p></div>
            <div className="title-party" aria-hidden="true">{[2, 1, 5, 4, 9].map((id, i) => <QuestCharacter key={id} id={id} className={`party-member party-${i}`} />)}</div>
          </div>
          <h1 className="match-logo illustrated-logo" ref={heading} tabIndex={-1}><Image src="/shindan/quest-logo-v5.webp" alt="適職診断 — NARU CAREER QUEST" width={2172} height={724} priority unoptimized /></h1>
          <div className="title-caption"><p className="title-tagline">きみの才能は、まだ冒険の途中だ。</p><span className="guild-class-badge">16 CLASSES</span></div>
        </div>
        <div className="title-actions"><button className="diagnose-start" onClick={start} disabled={busy}>冒険をはじめる<span aria-hidden="true">→</span></button><p className="start-note">全20問・約2分 ／ 無料・登録不要</p><button className="archive-link" onClick={() => setScreen("types")} disabled={busy}>16タイプの冒険者を見る <span aria-hidden="true">↗</span></button></div>
        <p className="title-disclaimer">自己理解のヒントを楽しむための診断です。</p>
      </section>}

      {screen === "quiz" && <section id="quiz-screen" className="screen match-quiz">
        <p className="quest-chapter">NARU GUILD / QUEST LOG</p>
        <div className="question-stack" aria-live="polite" aria-atomic="true">
          {previousQuestion !== null && <div className="question-card previous-card" aria-hidden="true"><FrameCorners /><p className="question-count">Q{previousQuestion + 1}<small>/{MATCH_QUESTIONS.length}</small></p><p className="question-copy">{MATCH_QUESTIONS[previousQuestion].text}</p></div>}
          <div className={`question-card card-in ${selected !== null ? "card-answered" : ""}`} key={qIndex}><FrameCorners /><p className="question-count">Q{qIndex + 1}<small>/{MATCH_QUESTIONS.length}</small></p><h1 className="question-copy" ref={heading} tabIndex={-1}>{MATCH_QUESTIONS[qIndex].text}</h1></div>
        </div>
        <div className="binary-answers" aria-label="質問への回答">
          <button className={`binary-button yes-button ${selected === true ? "is-selected" : ""}`} onClick={() => answer(true)} disabled={busy}><span aria-hidden="true">✦</span>YES!<small>はい</small></button>
          <button className={`binary-button no-button ${selected === false ? "is-selected" : ""}`} onClick={() => answer(false)} disabled={busy}><span aria-hidden="true">×</span>NO!<small>いいえ</small></button>
        </div>
        <p className="quiz-instruction">直感で選んでOK。正解も不正解もありません。</p>
        <div className="quiz-progress" role="progressbar" aria-label="回答済みの質問" aria-valuemin={0} aria-valuemax={20} aria-valuenow={answers.length}><span style={{ width: `${answers.length * 5}%` }} /></div>
      </section>}

      {screen === "matching" && <section className="screen matching-screen" aria-label="診断結果を準備しています"><div className="question-card matching-card"><FrameCorners /><div className="match-status" role="status"><p className="matching-message">APPRAISING...</p><h1 className="matched-message" ref={heading} tabIndex={-1}>CLASS FOUND!</h1></div><div className="matching-meter"><span /></div><p className="matching-caption">あなたの冒険者タイプを見つけています</p></div></section>}

      {screen === "result" && <section id="result-screen" className="screen"><ResultContent typeId={resultTypeId} typeInfo={TYPES16[resultTypeId]} onRetry={showTitle} /></section>}
      {screen === "types" && <section id="types-screen" className="screen"><div className="types-panel"><p className="section-kicker">CHARACTER ARCHIVE</p><h1 className="types-heading" ref={heading} tabIndex={-1}>16人の冒険者たち。</h1><p>どんな個性にも、活躍できるフィールドがある。</p><button className="text-button" onClick={showTitle}>← 診断トップへ</button><div className="types-grid">{Object.entries(TYPES16).map(([id, type]) => <Link href={`/types/${type.slug}`} className="type-card" key={id}><span className="type-number">CLASS {id.padStart(2, "0")}</span><QuestCharacter id={Number(id)} /><h2>{type.name}</h2><p>{type.desc}</p><span className="type-detail">タイプを詳しく見る ↗</span></Link>)}</div><button className="diagnose-start" onClick={start} disabled={busy}>自分のタイプを診断する →</button></div></section>}
    </div>
  );
}
