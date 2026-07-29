"use client";

const SURVEY_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScDn4OFzXXGVQ7kOwEN8B1ctymOTfEdV5ml_21noJ6f4whYNw/viewform";

export function SurveyLink({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={SURVEY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        if (typeof window !== "undefined") {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: "to_survey" });
        }
      }}
    >
      {children}
    </a>
  );
}
