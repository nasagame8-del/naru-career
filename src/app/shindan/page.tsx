"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TYPES16 } from "./_lib/data";
import { diagnose, MATCH_QUESTIONS } from "./_lib/matching";
import { trackEvent } from "./_lib/analytics";
import ResultContent from "./_components/ResultContent";
import QuestCharacter from "./_components/QuestCharacter";

type Screen = "title" | "quiz" | "matching" | "result" | "types";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<boolean | null>(null);
  const [resultTypeId, setResultTypeId] = useState(1);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [screen, qIndex]);

  function delay(callback: () => void, duration: number) {
    if (timer.current) clearTimeout(timer.current);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(callback, reducedMotion ? 0 : duration);
  }

  function unlock() {
    setSelected(null);
    setBusy(false);
    locked.current = false;
  }

  function showTitle() {
    if (timer.current) clearTimeout(timer.current);
    unlock();
    setAnswers([]);
    setQIndex(0);
    setScreen("title");
  }

  function start() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setAnswers([]);
    setQIndex(0);
    setSelected(null);
    setScreen("quiz");
    delay(unlock, 220);
  }

  function answer(value: boolean) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setSelected(value);

    if (qIndex === 0) trackEvent("quiz_start");

    const next = [...answers, value];
    setAnswers(next);

    delay(() => {
      if (next.length === MATCH_QUESTIONS.length) {
        const id = diagnose(next);
        setResultTypeId(id);
        trackEvent("quiz_complete", { type: TYPES16[id].name });
        setScreen("matching");
        delay(() => {
          setScreen("result");
          unlock();
        }, 900);
      } else {
        setQIndex(qIndex + 1);
        setSelected(null);
        unlock();
      }
    }, 120);
  }

  const progress = Math.round((answers.length / MATCH_QUESTIONS.length) * 100);

  return (
    <div className={`stage screen-${screen}`}>
      <header className="diagnosis-header">
        <Link href="/" className="diagnosis-brand" aria-label="NARU トップへ">
          NARU
        </Link>
        <span className="diagnosis-header-label">適職診断</span>
        {screen !== "title" && (
          <button className="header-back" onClick={showTitle} disabled={busy}>
            最初に戻る
          </button>
        )}
      </header>

      {screen === "title" && (
        <main className="screen diagnosis-start-screen">
          <section className="intro-copy">
            <p className="eyebrow">NARU 適職診断</p>
            <h1 ref={heading} tabIndex={-1}>
              働き方のクセから、
              <br />
              向いている仕事を考える。
            </h1>
            <p className="intro-lead">
              20の質問にYES／NOで答えると、あなたの傾向を16タイプに整理します。
              「当てる」ためではなく、仕事選びの軸を増やすための診断です。
            </p>

            <div className="intro-meta" aria-label="診断の概要">
              <span>20問</span>
              <span>約2分</span>
              <span>登録不要</span>
            </div>

            <button className="primary-action" onClick={start} disabled={busy}>
              診断をはじめる
              <span aria-hidden="true">→</span>
            </button>

            <button className="secondary-action" onClick={() => setScreen("types")} disabled={busy}>
              16タイプを先に見る
            </button>

            <p className="intro-note">
              診断結果は自己理解のヒントです。職種や転職先を断定するものではありません。
            </p>
          </section>

          <aside className="character-preview" aria-label="16タイプのキャラクター例">
            <div className="preview-grid" aria-hidden="true">
              {[2, 1, 5, 4, 9, 12].map((id) => (
                <QuestCharacter key={id} id={id} />
              ))}
            </div>
            <div className="preview-copy">
              <span>16 TYPES</span>
              <p>性格ではなく、仕事で出やすい行動傾向として整理します。</p>
            </div>
          </aside>
        </main>
      )}

      {screen === "quiz" && (
        <main className="screen diagnosis-quiz">
          <div className="quiz-shell">
            <div className="quiz-topline">
              <p>質問 {qIndex + 1} / {MATCH_QUESTIONS.length}</p>
              <span>{progress}%</span>
            </div>

            <div className="quiz-progress" role="progressbar" aria-label="回答済みの質問" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <span style={{ width: `${progress}%` }} />
            </div>

            <section className="question-card" aria-live="polite" aria-atomic="true">
              <p className="question-kicker">あなたはどちらに近い？</p>
              <h1 className="question-copy" ref={heading} tabIndex={-1}>
                {MATCH_QUESTIONS[qIndex].text}
              </h1>
            </section>

            <div className="binary-answers" aria-label="質問への回答">
              <button
                className={`binary-button yes-button ${selected === true ? "is-selected" : ""}`}
                onClick={() => answer(true)}
                disabled={busy}
              >
                <strong>YES</strong>
                <small>あてはまる</small>
              </button>
              <button
                className={`binary-button no-button ${selected === false ? "is-selected" : ""}`}
                onClick={() => answer(false)}
                disabled={busy}
              >
                <strong>NO</strong>
                <small>あてはまらない</small>
              </button>
            </div>

            <p className="quiz-instruction">
              深く考えすぎず、普段の自分に近い方を選んでください。
            </p>
          </div>
        </main>
      )}

      {screen === "matching" && (
        <main className="screen matching-screen" aria-label="診断結果を準備しています">
          <div className="matching-card" role="status">
            <span className="matching-label">診断中</span>
            <h1 ref={heading} tabIndex={-1}>回答を整理しています</h1>
            <div className="matching-meter"><span /></div>
            <p>あなたの仕事上の傾向を16タイプと照らし合わせています。</p>
          </div>
        </main>
      )}

      {screen === "result" && (
        <main id="result-screen" className="screen">
          <ResultContent typeId={resultTypeId} typeInfo={TYPES16[resultTypeId]} onRetry={showTitle} />
        </main>
      )}

      {screen === "types" && (
        <main id="types-screen" className="screen">
          <div className="types-panel">
            <div className="types-intro">
              <p className="eyebrow">16 TYPES</p>
              <h1 ref={heading} tabIndex={-1}>16タイプから、自分の働き方を考える。</h1>
              <p>どのタイプにも強みと苦手があります。気になるタイプから先に読んでも構いません。</p>
              <button className="text-button" onClick={showTitle}>← 診断トップへ</button>
            </div>

            <div className="types-grid">
              {Object.entries(TYPES16).map(([id, type]) => (
                <Link href={`/types/${type.slug}`} className="type-card" key={id}>
                  <span className="type-number">TYPE {id.padStart(2, "0")}</span>
                  <QuestCharacter id={Number(id)} />
                  <h2>{type.name}</h2>
                  <p>{type.desc}</p>
                  <span className="type-detail">詳しく見る →</span>
                </Link>
              ))}
            </div>

            <button className="primary-action types-start" onClick={start} disabled={busy}>
              自分のタイプを診断する
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
