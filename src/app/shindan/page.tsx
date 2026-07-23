"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  QUESTIONS,
  TYPE_MAP,
  TYPES16,
  BATTLES,
  HITS_TO_DEFEAT,
  BATTLE_MS,
} from "./_lib/data";
import ResultContent from "./_components/ResultContent";
import { trackEvent } from "./_lib/analytics";

type Screen = "title" | "quiz" | "result" | "types";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [qIndex, setQIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [resultTypeId, setResultTypeId] = useState<number>(1);
  const [answering, setAnswering] = useState(false);

  const battleHeroRef = useRef<HTMLImageElement>(null);
  const battleMonRef = useRef<HTMLImageElement>(null);
  const battleKoRef = useRef<HTMLDivElement>(null);
  const currentArcRef = useRef<string>("");
  const hitsInArcRef = useRef<number>(0);

  const retrigger = useCallback(
    (el: HTMLElement | null, cls: string) => {
      if (!el) return;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    },
    []
  );

  const getMonsterKind = (qNum: number) =>
    qNum <= 3 ? "slime" : qNum <= 6 ? "mage" : "dragon";

  const playBattle = useCallback(
    (qNum: number): number => {
      const kind = getMonsterKind(qNum);
      const heroEl = battleHeroRef.current;
      const monEl = battleMonRef.current;
      const koEl = battleKoRef.current;

      if (kind !== currentArcRef.current) {
        currentArcRef.current = kind;
        hitsInArcRef.current = 0;
        if (monEl) {
          monEl.classList.remove("shown", "enter-hit", "hurt", "defeat");
        }
      }
      hitsInArcRef.current++;

      if (heroEl) {
        heroEl.classList.add("shown");
        retrigger(heroEl, "attack");
      }

      if (hitsInArcRef.current === 1) {
        const info = BATTLES[kind];
        if (monEl) {
          monEl.src = info.src;
          monEl.style.setProperty("--mw", info.width);
          monEl.classList.remove("hurt", "defeat");
          monEl.classList.add("shown");
          retrigger(monEl, "enter-hit");
        }
        return BATTLE_MS.enter;
      }

      if (hitsInArcRef.current >= HITS_TO_DEFEAT[kind]) {
        if (monEl) {
          monEl.classList.remove("enter-hit", "hurt");
          retrigger(monEl, "defeat");
        }
        if (koEl) retrigger(koEl, "show");
        return BATTLE_MS.defeat;
      }

      if (monEl) {
        monEl.classList.remove("enter-hit", "defeat");
        retrigger(monEl, "hurt");
      }
      return BATTLE_MS.hurt;
    },
    [retrigger]
  );

  const handleAnswer = useCallback(
    (choiceIdx: number) => {
      if (answering) return;
      setAnswering(true);

      if (qIndex === 0) trackEvent("quiz_start");

      const newScores = { ...scores };
      const ts = QUESTIONS[qIndex].types[choiceIdx] || [];
      ts.forEach((t) => {
        newScores[t] = (newScores[t] || 0) + 1;
      });
      setScores(newScores);

      const qNum = qIndex + 1;
      const delay = playBattle(qNum);

      setTimeout(() => {
        if (qNum >= QUESTIONS.length) {
          let best: string | null = null;
          let max = -1;
          for (const t of Object.keys(newScores)) {
            if (newScores[t] > max) {
              max = newScores[t];
              best = t;
            }
          }
          const id = best ? TYPE_MAP[best] || 1 : 1;
          trackEvent("quiz_complete", { type: TYPES16[id].name });
          setResultTypeId(id);
          setScreen("result");
        } else {
          setQIndex(qNum);
          setAnswering(false);
        }
      }, delay);
    },
    [answering, scores, qIndex, playBattle]
  );

  const handleRetry = useCallback(() => {
    setScores({});
    setQIndex(0);
    setResultTypeId(1);
    currentArcRef.current = "";
    hitsInArcRef.current = 0;
    const heroEl = battleHeroRef.current;
    const monEl = battleMonRef.current;
    if (heroEl) heroEl.classList.remove("shown", "attack");
    if (monEl) monEl.classList.remove("shown", "enter-hit", "hurt", "defeat");
    setAnswering(false);
    setScreen("title");
  }, []);

  const typeInfo = TYPES16[resultTypeId];

  return (
    <div className="stage">
      {/* ── Title Screen ── */}
      {screen === "title" && (
        <section id="title-screen" className="screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="title-bg" src="/shindan/title-bg.png" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="title-logo"
            src="/shindan/title-logo.png"
            alt="RPG適職診断"
          />
          <Leaves />
          <div className="board-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="title-board"
              src="/shindan/title-board.png"
              alt=""
            />
            <button
              className="menu-btn start"
              onClick={() => setScreen("quiz")}
            >
              診断を始める
            </button>
            <button
              className="menu-btn types"
              onClick={() => setScreen("types")}
            >
              16タイプを見る
            </button>
          </div>
        </section>
      )}

      {/* ── Quiz Screen ── */}
      {screen === "quiz" && (
        <section id="quiz-screen" className="screen">
          <div className="progress">
            {qIndex + 1} / {QUESTIONS.length}
          </div>
          <div className="banner-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="banner-img" src="/shindan/banner.png" alt="" />
            <div className="question">{QUESTIONS[qIndex].q}</div>
            {QUESTIONS[qIndex].options.map((opt, i) => (
              <button
                key={`${qIndex}-${i}`}
                className={`card c${i + 1}`}
                onClick={() => handleAnswer(i)}
                disabled={answering}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/shindan/card${i + 1}.png`} alt="" />
                <div className="label">{opt}</div>
              </button>
            ))}
          </div>
          <div className="battle-fx">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="battle-hero"
              ref={battleHeroRef}
              src="/shindan/hero-attack.png"
              alt=""
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="battle-monster"
              ref={battleMonRef}
              alt=""
            />
            <div className="battle-ko-label" ref={battleKoRef}>
              撃破！
            </div>
          </div>
        </section>
      )}

      {/* ── Result Screen ── */}
      {screen === "result" && (
        <section id="result-screen" className="screen">
          <ResultContent
            typeId={resultTypeId}
            typeInfo={typeInfo}
            onRetry={handleRetry}
          />
        </section>
      )}

      {/* ── Types Screen ── */}
      {screen === "types" && (
        <section id="types-screen" className="screen">
          <div className="types-panel">
            <h2 className="types-heading">16タイプ一覧</h2>
            <div className="types-grid">
              {Object.entries(TYPES16).map(([id, t]) => (
                <div className="type-card" key={id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/shindan/types/type${id}.png`}
                    alt={t.name}
                  />
                  <h3>{t.name}</h3>
                  <p>{t.desc}</p>
                </div>
              ))}
            </div>
            <button
              className="types-back"
              onClick={() => setScreen("title")}
            >
              戻る
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Leaves() {
  const [mounted, setMounted] = useState(false);
  const leavesRef = useRef<
    { y: string; sway: string; dur: string; delay: string }[]
  >([]);

  useEffect(() => {
    if (leavesRef.current.length === 0) {
      leavesRef.current = Array.from({ length: 12 }, () => ({
        y: `${Math.random() * 80}%`,
        sway: `${(Math.random() - 0.5) * 20}cqh`,
        dur: `${6 + Math.random() * 6}s`,
        delay: `${Math.random() * 8}s`,
      }));
    }
    setMounted(true);
  }, []);

  if (!mounted) return <div className="title-leaves" />;

  return (
    <div className="title-leaves">
      {leavesRef.current.map((l, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          className="leaf"
          src="/shindan/leaf.png"
          alt=""
          style={
            {
              "--y": l.y,
              "--sway": l.sway,
              "--dur": l.dur,
              "--delay": l.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
