import { MiniAlto } from "./MiniAlto";

type BoxProps = {
  children: React.ReactNode;
};

/** 要点強調ボックス: alto-mini-idea + アンバー系枠 */
export function PointBox({ children }: BoxProps) {
  return (
    <div className="relative border border-accent/30 bg-accent-soft/40 rounded-lg px-5 py-4 my-6 pl-[72px] min-h-[80px]">
      <div className="absolute left-3 top-3">
        <MiniAlto pose="idea" size={48} />
      </div>
      <p className="text-[11px] font-bold text-accent mb-1 tracking-wider">POINT</p>
      <div className="text-sm text-ink leading-relaxed">{children}</div>
    </div>
  );
}

/** 注意・失敗談ボックス: alto-mini-alert + 警告色枠 */
export function CautionBox({ children }: BoxProps) {
  return (
    <div className="relative border border-red-200 bg-red-50/40 rounded-lg px-5 py-4 my-6 pl-[72px] min-h-[80px]">
      <div className="absolute left-3 top-3">
        <MiniAlto pose="alert" size={48} />
      </div>
      <p className="text-[11px] font-bold text-red-500 mb-1 tracking-wider">CAUTION</p>
      <div className="text-sm text-ink leading-relaxed">{children}</div>
    </div>
  );
}

/** 著者のひとことコメント: alto-mini-think + 吹き出し */
export function AltoComment({ children }: BoxProps) {
  return (
    <div className="flex gap-3 items-start my-6">
      <div className="shrink-0 mt-1">
        <MiniAlto pose="think" size={48} />
      </div>
      <div className="relative bg-bg-soft border border-line rounded-lg px-4 py-3 flex-1">
        {/* 吹き出し三角 */}
        <div className="absolute -left-2 top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-line" />
        <div className="absolute -left-[6px] top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-bg-soft" />
        <p className="text-[11px] font-bold text-ink-soft mb-1">アルトのひとこと</p>
        <div className="text-sm text-ink leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
