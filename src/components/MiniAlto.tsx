import Image from "next/image";

type Pose =
  | "guide" | "idea" | "alert" | "success"
  | "think" | "read" | "bow" | "break";

const POSES: Record<Pose, string> = {
  guide: "/images/mini/alto-mini-guide.png",
  idea: "/images/mini/alto-mini-idea.png",
  alert: "/images/mini/alto-mini-alert.png",
  success: "/images/mini/alto-mini-success.png",
  think: "/images/mini/alto-mini-think.png",
  read: "/images/mini/alto-mini-read.png",
  bow: "/images/mini/alto-mini-bow.png",
  break: "/images/mini/alto-mini-break.png",
};

type Props = {
  pose: Pose;
  size?: number;
  className?: string;
};

export function MiniAlto({ pose, size = 56, className = "" }: Props) {
  return (
    <Image
      src={POSES[pose]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      className={`select-none pointer-events-none ${className}`}
    />
  );
}
