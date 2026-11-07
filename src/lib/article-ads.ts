/** Reviewed advertising destinations; categories never automatically opt articles in. */
export type ArticleAd = "kosmo" | "anycrew";

export const ARTICLE_ADS: Readonly<Partial<Record<string, ArticleAd>>> = {
  "resume-writing-second-new-grad": "kosmo",
  "second-new-grad-it-interview-questions": "kosmo",
  "interview-failure-why-this-job": "kosmo",
  "interview-scheduling-while-employed": "kosmo",
  "job-change-timing-3months": "kosmo",
  "second-new-grad-desired-salary-2026": "kosmo",
  "second-new-grad-job-change-traps": "kosmo",
  "second-new-grad-it-company-research": "kosmo",
  "second-new-grad-april-entry-schedule": "kosmo",
  "winter-bonus-job-change-timing": "kosmo",
  "it-industry-quit-myth": "kosmo",
  "it-training-program-job-checklist": "kosmo",
  "what-is-web-industry": "kosmo",
  "second-new-grad-web-director-career": "kosmo",
  "second-new-grad-web-marketing-career": "kosmo",
  "second-new-grad-web-agency-vs-inhouse": "kosmo",
  "second-new-grad-it-portfolio-guide": "kosmo",
  "beginner-engineer-tutorial-portfolio": "kosmo",
  "vaguely-want-to-quit": "kosmo",
  "small-trigger-to-quit": "kosmo",
  "certification-exam-on-hold": "kosmo",
  "probation-period-lower-salary-checks": "kosmo",
  "contractor-how-to-quit": "kosmo",
  "outsourcing-contract-termination-worker-status": "kosmo",
  "offer-letter-before-acceptance-not-provided": "kosmo",
  "contractor-exclusivity-noncompete-checks": "anycrew",
};

export function getArticleAd(slug: string): ArticleAd | undefined {
  return Object.hasOwn(ARTICLE_ADS, slug) ? ARTICLE_ADS[slug] : undefined;
}
