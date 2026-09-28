import type { CSSProperties } from "react";

/** The generated atlas contains 16 equally sized cells, in TYPE_MAP order. */
export default function QuestCharacter({ id, name, className = "" }: { id: number; name?: string; className?: string }) {
  const index = Math.max(0, Math.min(15, id - 1));
  return <div className={`quest-character ${className}`} role={name ? "img" : undefined} aria-label={name} aria-hidden={name ? undefined : true} style={{ "--character-x": `${(index % 4) * 100 / 3}%`, "--character-y": `${Math.floor(index / 4) * 100 / 3}%` } as CSSProperties} />;
}
