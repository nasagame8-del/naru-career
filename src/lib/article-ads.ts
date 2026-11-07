/** Reviewed advertising destinations; categories never automatically opt articles in. */
export type ArticleAd = "kosmo" | "anycrew" | "uzuz" | "retirement_jobs" | "retirement_zen";

export const ARTICLE_ADS: Readonly<Partial<Record<string, ArticleAd>>> = {
  "resume-writing-second-new-grad": "uzuz",
  "second-new-grad-it-interview-questions": "uzuz",
  "interview-failure-why-this-job": "uzuz",
  "interview-scheduling-while-employed": "uzuz",
  "job-change-timing-3months": "uzuz",
  "second-new-grad-desired-salary-2026": "uzuz",
  "second-new-grad-job-change-traps": "uzuz",
  "second-new-grad-it-company-research": "uzuz",
  "second-new-grad-april-entry-schedule": "uzuz",
  "winter-bonus-job-change-timing": "uzuz",
  "it-industry-quit-myth": "uzuz",
  "it-training-program-job-checklist": "uzuz",
  "what-is-web-industry": "uzuz",
  "second-new-grad-web-director-career": "uzuz",
  "second-new-grad-web-marketing-career": "uzuz",
  "second-new-grad-web-agency-vs-inhouse": "uzuz",
  "second-new-grad-it-portfolio-guide": "uzuz",
  "beginner-engineer-tutorial-portfolio": "uzuz",
  "vaguely-want-to-quit": "uzuz",
  "small-trigger-to-quit": "uzuz",
  "certification-exam-on-hold": "uzuz",
  "probation-period-lower-salary-checks": "kosmo",
  "contractor-how-to-quit": "kosmo",
  "outsourcing-contract-termination-worker-status": "kosmo",
  "offer-letter-before-acceptance-not-provided": "kosmo",
  "contractor-exclusivity-noncompete-checks": "anycrew",
  "employee-contractor-pay-comparison": "uzuz",
  "business-outsourcing-conversion-risk": "kosmo",
  "employee-to-contractor-unemployment-benefit": "kosmo",
  "employee-to-contractor-social-insurance": "kosmo",
  "how-to-resign-experience": "retirement_jobs",
  "retirement-agency-second-new-grad-how-to-choose": "retirement_zen",
};

export function getArticleAd(slug: string): ArticleAd | undefined {
  return Object.hasOwn(ARTICLE_ADS, slug) ? ARTICLE_ADS[slug] : undefined;
}

/** These articles already have an in-body ad; do not duplicate it at the mobile footer. */
export function shouldShowMobileArticleAd(slug: string): boolean {
  return Boolean(getArticleAd(slug)) && ![
    "contractor-exclusivity-noncompete-checks",
    "how-to-resign-experience",
    "retirement-agency-second-new-grad-how-to-choose",
  ].includes(slug);
}
