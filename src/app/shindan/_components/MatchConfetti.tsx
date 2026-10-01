import type { CSSProperties } from "react";

const COLORS = ["#1f6f66", "#b5691b", "#e5c992", "#91764f", "#b97554"];
export default function MatchConfetti() {
  return <div className="match-confetti" aria-hidden="true">{Array.from({ length: 65 }, (_, index) => <i key={index} style={{
    "--confetti-x": `${(index * 37) % 101}%`,
    "--confetti-color": COLORS[index % COLORS.length],
    "--confetti-duration": `${3.2 + (index % 7) * .35}s`,
    "--confetti-delay": `${(index % 11) * .11}s`,
    "--confetti-drift": `${(index % 2 ? 1 : -1) * (30 + index % 70)}px`,
  } as CSSProperties} />)}</div>;
}
