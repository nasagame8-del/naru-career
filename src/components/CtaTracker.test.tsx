import { afterEach, describe, expect, it, vi } from "vitest";

// The tracker only needs React's effect registration; simulate the browser
// event listener without adding a DOM test dependency.
vi.mock("react", () => ({
  useEffect: (setup: () => void | (() => void)) => { setup(); },
}));

import { CtaTracker } from "./CtaTracker";

type TrackedLink = {
  dataset: Record<string, string>;
  textContent: string;
  href: string;
};

function clickThroughTracker(link: TrackedLink | null) {
  let clickListener: ((event: MouseEvent) => void) | undefined;
  const addEventListener = vi.fn((type: string, listener: (event: MouseEvent) => void) => {
    if (type === "click") clickListener = listener;
  });

  const dataLayer: Record<string, unknown>[] = [];
  vi.stubGlobal("document", { addEventListener, removeEventListener: vi.fn() });
  vi.stubGlobal("window", { dataLayer });

  CtaTracker();
  expect(clickListener).toBeDefined();

  clickListener!({
    target: { closest: () => link },
  } as unknown as MouseEvent);

  return dataLayer;
}

afterEach(() => vi.unstubAllGlobals());

describe("CtaTracker", () => {
  it("emits an agent diagnosis outbound event", () => {
    expect(clickThroughTracker({
      dataset: {
        trackEvent: "agent_diagnosis_cta_click",
        trackAgent: "neo_career_agent",
        trackDestination: "external",
      },
      textContent: "公式サイトを見る",
      href: "https://example.com/",
    })).toEqual([{
      event: "agent_diagnosis_cta_click",
      agent: "neo_career_agent",
      destination: "external",
    }]);
  });

  it("emits a separate comparison-article event", () => {
    expect(clickThroughTracker({
      dataset: {
        trackEvent: "agent_diagnosis_article_click",
        trackAgent: "doda",
        trackDestination: "comparison",
      },
      textContent: "エージェント比較で詳しく見る",
      href: "https://naru-career.com/articles/agent-comparison-2026",
    })).toEqual([{
      event: "agent_diagnosis_article_click",
      agent: "doda",
      destination: "comparison",
    }]);
  });

  it("keeps the existing CTA fallback event", () => {
    expect(clickThroughTracker({
      dataset: {},
      textContent: "エージェント比較を見る",
      href: "https://naru-career.com/articles/agent-comparison-2026",
    })).toEqual([{
      event: "cta_click",
      agent_name: "エージェント比較を見る",
      link_url: "https://naru-career.com/articles/agent-comparison-2026",
    }]);
  });

  it("does nothing when no CTA link matches", () => {
    expect(clickThroughTracker(null)).toEqual([]);
  });
});
