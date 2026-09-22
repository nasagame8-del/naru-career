# User-selected article queue — 2026-09-23

Status: QUEUED (not yet triggered). Do not interrupt active INST-004. After REPORT-004 completes and the current work is safe to continue, ChatGPT should issue the next instruction to Claude for these two selected articles, then trigger the existing Claude GitHub Action via the correct PR comment. This queue is not permission to merge or deploy production.

## Article 1
- Working title: 第二新卒でWebマーケティングは未経験でも転職できる？仕事内容・必要スキル・求人の見方
- Target intent: 第二新卒 Webマーケ 未経験; determine whether and how to enter Web marketing without direct experience.
- Differentiate from existing general IT career-change and AIO/SEO industry articles; focus on the Web marketing role, job descriptions, transferable skills, how to evaluate listings, and practical application steps.

## Article 5
- Working title: 第二新卒の転職活動は働きながら？辞めてから？20代で失敗しにくい進め方
- Target intent: 第二新卒 転職 働きながら / 辞めてから; compare practical considerations of starting a job search while employed versus after resignation.
- Differentiate from existing resignation and post-transition articles; focus on timing, time management, financial runway, interview scheduling, and decision checklist. Avoid one-size-fits-all advice.

## Acceptance criteria
- Reinspect latest article inventory (37+), active PRs and existing slugs before writing; avoid duplicates and keyword cannibalization. Check whether previously selected SaaS sales and salary articles already exist or are pending before proposing internal links.
- Use Search Console evidence only if actually available; do not invent metrics, search volume, rankings, citations, or personal experience.
- Use attributable primary sources for factual/time-sensitive claims; preserve supported author facts only and do not fabricate first-person accounts.
- Produce both complete articles with valid existing frontmatter, appropriate internal links to real existing routes, and SEO QA. Follow current Article Factory/SEO Editor safety gates and run available tests, typecheck and build. Include results in REPORT.
- Create/update a draft PR for review on a feature branch; do not directly push articles to master, merge, or deploy without a separate explicit authorization.
- After actual Claude trigger, report '投入完了' to the user. Until then report only '投入予約'.
