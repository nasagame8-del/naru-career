/**
 * 新規記事オートパイロットの耐久実行（Vercel Workflow DevKit）。
 *
 * 設計:
 *   - "use workflow" はオーケストレーションのみ。Node/OpenAI/GitHub は触らない。
 *   - Node・OpenAI・GitHub の処理はすべて "use step" 関数に閉じ込める。
 *     step はサンドボックス外で動き、失敗時は自動リトライされる。
 *   - 境界を越えるデータはプレーンなJSONのみ。
 *   - 恒久的な失敗は FatalError、一時的な失敗は RetryableError で分類する。
 *
 * これによりブラウザを閉じても実行が継続し、runId で再接続できる。
 */

import {
  FatalError,
  RetryableError,
  getWritable,
  getWorkflowMetadata,
  sleep,
} from "workflow";
// workflow 本体が直接使う値は、process.env を含まない純粋な定数モジュールから取る。
// 環境変数（自動公開フラグなど）は stepIsAutoPublishAuthorized() 経由でのみ受け取る。
import { ARTICLE_RUN_DIR, SITE_URL, WAIT } from "./constants";
import { isAutoPublishAuthorized } from "./config";
import { readInventory } from "./inventory";
import { runOutline, runWrite, runInternalLinks } from "./generation";
import { runResearch } from "./research";
// 純粋な判定・適用ロジックのみ workflow 本体へ import する。
// planSourceRepair（OpenAI依存）は step の内部でのみ使うため、
// 別モジュール source-repair-planner から取り込む。
import {
  applyRepairPlan,
  decideRepairAction,
  MAX_SOURCE_REPAIR_ATTEMPTS,
} from "./source-repair";
import { planSourceRepair } from "./source-repair-planner";
import { buildArticleMarkdown, buildImagePlan } from "./markdown";
import {
  canAutoPublish,
  checkCannibalization,
  extractInternalLinkPaths,
  runQa,
  type ExistingArticleRef,
} from "./safety";
import {
  evaluateDeployment,
  evaluateMergeGate,
  evaluateRequiredChecks,
  REQUIRED_CHECKS,
  type DeploymentDecision,
  type MergeGateDecision,
  type RequiredChecksDecision,
} from "./checks";
import {
  createArticlePullRequest,
  getChecksForSha,
  getDeploymentStatusesForSha,
  getPullRequestState,
  mergeArticlePullRequest,
  ArticleGithubError,
} from "./github";
import type {
  ArticleChange,
  ArticleDraft,
  ArticlePhase,
  ArticleRunResult,
  PhaseState,
  PublishResult,
  QaResult,
  ResearchResult,
  SelectedTopic,
  WorkflowEvent,
} from "./types";
import { isPermanentLlmErrorMessage } from "./llm-policy";

// ── 進捗ストリーム ──

/**
 * 進捗をワークフローのストリームへ書き出す。
 *
 * ダッシュボードは runId でこのストリームを読み直せるため、
 * ページをリロードしても現在のフェーズを復元できる。
 */
async function emit(event: WorkflowEvent): Promise<void> {
  "use step";
  const writer = getWritable<WorkflowEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

function phaseEvent(phase: ArticlePhase, state: PhaseState, message: string): WorkflowEvent {
  return { type: "phase", phase, state, message, at: new Date().toISOString() };
}

// ── Steps（Node / OpenAI / GitHub はすべてここ） ──

interface InventorySnapshot {
  existing: ExistingArticleRef[];
  existingSlugs: string[];
  knownPaths: string[];
  size: number;
  nextArticleId: number;
}

async function stepReadInventory(): Promise<InventorySnapshot> {
  "use step";
  const inv = readInventory();
  return {
    existing: inv.existing,
    existingSlugs: inv.existingSlugs,
    knownPaths: inv.knownPaths,
    size: inv.size,
    nextArticleId: inv.nextArticleId,
  };
}

/** 重複チェック。重複していれば理由を返す（例外は投げない） */
async function stepCheckCannibalization(
  topic: SelectedTopic,
  existing: ExistingArticleRef[]
): Promise<{ duplicate: boolean; reason: string }> {
  "use step";
  const v = checkCannibalization(
    { title: topic.title, primaryKeyword: topic.primaryKeyword, slug: topic.slug },
    existing
  );
  return { duplicate: v.duplicate, reason: v.reason };
}

async function stepResearch(topic: SelectedTopic): Promise<ResearchResult> {
  "use step";
  try {
    return await runResearch(topic);
  } catch (e) {
    throw classifyLlmError(e, "調査フェーズ");
  }
}

async function stepOutline(topic: SelectedTopic, research: ResearchResult) {
  "use step";
  try {
    return await runOutline(topic, research);
  } catch (e) {
    throw classifyLlmError(e, "構成フェーズ");
  }
}

async function stepWrite(
  topic: SelectedTopic,
  outline: Awaited<ReturnType<typeof runOutline>>,
  research: ResearchResult
): Promise<ArticleDraft> {
  "use step";
  try {
    return await runWrite(topic, outline, research);
  } catch (e) {
    throw classifyLlmError(e, "執筆フェーズ");
  }
}

async function stepInternalLinks(
  draft: ArticleDraft,
  knownPaths: string[]
): Promise<ArticleDraft> {
  "use step";
  try {
    return await runInternalLinks(draft, knownPaths);
  } catch (e) {
    throw classifyLlmError(e, "内部リンクフェーズ");
  }
}

/** 画像プランを組み立てる。画像そのものは生成しない */
async function stepImagePlan(
  topic: SelectedTopic,
  draft: ArticleDraft,
  research: ResearchResult
): Promise<string> {
  "use step";
  const headings = draft.body
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.replace(/^##\s+/, "").trim());

  return buildImagePlan({
    slug: draft.slug,
    title: draft.frontmatter.title,
    articleId: topic.articleId,
    headings,
    sources: research.sources,
  });
}

async function stepQa(
  draft: ArticleDraft,
  research: ResearchResult,
  inventory: InventorySnapshot,
  changePaths: string[]
): Promise<QaResult> {
  "use step";
  return runQa({
    draft,
    research,
    existing: inventory.existing,
    existingSlugs: inventory.existingSlugs,
    knownPaths: new Set(inventory.knownPaths),
    changePaths,
    // このインフラでは記事追加がビルドを壊さないことを静的に保証できないため、
    // build未実行として扱う。QAはこれを NEEDS_REVIEW とし、自動公開を止める。
    buildPassed: null,
  });
}

/**
 * sources 由来のQA FAILを修復する。
 *
 * 追加Web検索とLLM呼び出しを伴うため **必ず step 側**で実行する。
 * 返すのはプレーンなJSONのみ。
 */
/**
 * 修復後の内部リンクを機械的に再検証する。
 *
 * 実在しない内部リンクはリンク記法を外してテキストへ戻す。
 * LLMは使わない（修復で本文が変わったことによるリンク破壊だけを見る）。
 */
async function stepRevalidateLinks(
  draft: ArticleDraft,
  knownPaths: string[]
): Promise<ArticleDraft> {
  "use step";
  const allowed = new Set(knownPaths);
  const body = draft.body.replace(
    /\[([^\]]*?)\]\((\/[^)\s]*)\)/g,
    (match, text: string, path: string) => (allowed.has(path.split(/[?#]/)[0]) ? match : text)
  );
  const internalLinks = extractInternalLinkPaths(body).filter((p) => allowed.has(p));
  return { ...draft, body, internalLinks, charCount: body.length };
}

async function stepRepairSources(
  claims: string[],
  draft: ArticleDraft,
  research: ResearchResult,
  context: { title: string; primaryKeyword: string }
): Promise<{
  body: string;
  research: ResearchResult;
  citationsAdded: number;
  editsApplied: number;
  claimsDropped: number;
  resolvedClaims: string[];
  rejected: string[];
  searchError: string | null;
}> {
  "use step";
  try {
    const planned = await planSourceRepair({ claims, body: draft.body, context });
    const applied = applyRepairPlan({
      body: draft.body,
      research,
      plan: planned.plan,
      verifiedUrls: planned.verifiedUrls,
      targetClaims: claims,
      retrievedAt: new Date().toISOString().slice(0, 10),
    });
    return { ...applied, searchError: planned.searchError };
  } catch (e) {
    throw classifyLlmError(e, "出典修復フェーズ");
  }
}

async function stepCreatePr(
  runId: string,
  topic: SelectedTopic,
  changes: ArticleChange[],
  qa: QaResult,
  publishBlockedReason: string | null
): Promise<PublishResult> {
  "use step";
  try {
    return await createArticlePullRequest({
      runId,
      topic,
      changes,
      qa,
      publishBlockedReason,
    });
  } catch (e) {
    if (e instanceof ArticleGithubError) {
      // 4xx は設定・入力の問題なのでリトライしない
      if (e.status >= 400 && e.status < 500) throw new FatalError(e.message);
      throw new RetryableError(e.message, { retryAfter: "1m" });
    }
    throw e;
  }
}

/**
 * CIが通ったあと、buildPassed を確定させてQAを再評価する。
 *
 * buildPassed に渡すのは**外部CIが成功したという事実**であり、
 * ローカルで勝手に true にした値ではない。
 */
async function stepQaWithBuild(
  draft: ArticleDraft,
  research: ResearchResult,
  inventory: InventorySnapshot,
  changePaths: string[],
  buildPassed: boolean
): Promise<QaResult> {
  "use step";
  return runQa({
    draft,
    research,
    existing: inventory.existing,
    existingSlugs: inventory.existingSlugs,
    knownPaths: new Set(inventory.knownPaths),
    changePaths,
    buildPassed,
  });
}

/**
 * PRのhead SHAに対する必須チェックを取得して判定する。
 *
 * GitHub API呼び出しはここ（step）で行い、
 * 待つかどうかの判断はワークフロー側が行う。
 */
async function stepEvaluateChecks(
  prNumber: number,
  startedAtMs: number
): Promise<{ decision: RequiredChecksDecision; headSha: string }> {
  "use step";
  try {
    const pr = await getPullRequestState(prNumber);
    const checks = await getChecksForSha(pr.headSha);
    const decision = evaluateRequiredChecks(checks, REQUIRED_CHECKS, {
      elapsedMs: Date.now() - startedAtMs,
      timeoutMs: WAIT.checkTimeoutMs,
      appearanceGraceMs: WAIT.checkAppearanceGraceMs,
    });
    return { decision, headSha: pr.headSha };
  } catch (e) {
    if (e instanceof ArticleGithubError) {
      if (e.status >= 400 && e.status < 500) throw new FatalError(e.message);
      throw new RetryableError(e.message, { retryAfter: "1m" });
    }
    throw e;
  }
}

/** マージ可否の最終判定。既にマージ済みかを含めて確認する（冪等） */
async function stepEvaluateMergeGate(
  prNumber: number,
  qaAllowed: boolean,
  qaReason: string,
  checks: RequiredChecksDecision
): Promise<MergeGateDecision> {
  "use step";
  const pr = await getPullRequestState(prNumber);
  return evaluateMergeGate({
    qaAllowed,
    qaReason,
    checks,
    alreadyMerged: pr.merged,
  });
}

/**
 * マージを実行し、マージコミットSHAを返す。
 * 既にマージ済みなら既存のマージコミットSHAを返す（冪等）。
 */
async function stepMerge(prNumber: number): Promise<string> {
  "use step";
  try {
    return await mergeArticlePullRequest(prNumber);
  } catch (e) {
    if (e instanceof ArticleGithubError && e.status >= 400 && e.status < 500) {
      throw new FatalError(e.message);
    }
    throw e;
  }
}

/** マージコミットに紐づく本番デプロイの状態を判定する */
async function stepEvaluateDeployment(
  mergeCommitSha: string,
  startedAtMs: number
): Promise<DeploymentDecision> {
  "use step";
  try {
    const statuses = await getDeploymentStatusesForSha(mergeCommitSha);
    return evaluateDeployment(statuses, {
      elapsedMs: Date.now() - startedAtMs,
      timeoutMs: WAIT.deployTimeoutMs,
    });
  } catch (e) {
    if (e instanceof ArticleGithubError) {
      if (e.status >= 400 && e.status < 500) throw new FatalError(e.message);
      throw new RetryableError(e.message, { retryAfter: "1m" });
    }
    throw e;
  }
}

/**
 * 自動公開フラグ（ARTICLE_FACTORY_AUTO_PUBLISH）を確認する。
 *
 * process.env はここ（step）でのみ読む。workflow 本体は返された boolean だけを使う。
 * 未設定・"true" 以外はすべて false（fail closed）。
 */
async function stepIsAutoPublishAuthorized(): Promise<boolean> {
  "use step";
  return isAutoPublishAuthorized();
}

/** LLM由来のエラーを恒久・一時に分類する */
function classifyLlmError(e: unknown, phase: string): Error {
  const message = e instanceof Error ? e.message : String(e);
  // クレジット枯渇・quota・認証エラーは待っても直らない。
  // 429というHTTPコードだけを見て再試行すると、同じ有料リクエストを数分間繰り返すため、
  // 一時的なrate limitとは明示的に分離する。
  if (isPermanentLlmErrorMessage(message)) {
    return new FatalError(`${phase}: ${message}`);
  }
  // 設定不備・スキーマ不一致は何度やっても直らない
  if (/OPENAI_API_KEY|未設定|Structured Output|形が想定と異なります/.test(message)) {
    return new FatalError(`${phase}: ${message}`);
  }
  if (/rate limit|429|timeout|ETIMEDOUT|ECONNRESET|503|502/i.test(message)) {
    return new RetryableError(`${phase}: ${message}`, { retryAfter: "2m" });
  }
  return new RetryableError(`${phase}: ${message}`, { retryAfter: "1m" });
}

// ── Workflow（オーケストレーションのみ） ──

/**
 * 選択されたトピックから記事PRまでを実行する。
 *
 * フェーズ順序は INST-003 の規定どおり:
 *   inventory → cannibalization → research → outline → write
 *   → internal-links → image-plan → qa → create-pr → publish
 */
export async function newArticleWorkflow(topic: SelectedTopic): Promise<ArticleRunResult> {
  "use workflow";

  /**
   * runId は SDK の採番をそのまま使う。
   * PRのbranch名・image-planのパスがこれで決まるため、
   * 同じrunを再実行しても同じbranch/PRに収束する（冪等）。
   */
  const runId = getWorkflowMetadata().workflowRunId;

  // 1. inventory
  await emit(phaseEvent("inventory", "running", "記事在庫を読み込んでいます"));
  const inventory = await stepReadInventory();
  await emit(phaseEvent("inventory", "done", `既存記事 ${inventory.size} 本を確認しました`));

  // 2. cannibalization
  await emit(phaseEvent("cannibalization", "running", "既存記事との重複を確認しています"));
  const cannibal = await stepCheckCannibalization(topic, inventory.existing);
  if (cannibal.duplicate) {
    await emit({
      type: "blocked",
      phase: "cannibalization",
      reason: cannibal.reason,
      code: "CANNIBALIZATION",
      at: new Date().toISOString(),
    });
    return {
      runId,
      slug: topic.slug,
      status: "blocked",
      reason: cannibal.reason,
      qa: null,
      publish: null,
    };
  }
  await emit(phaseEvent("cannibalization", "done", "重複は見つかりませんでした"));

  // 3. research
  await emit(phaseEvent("research", "running", "調査しています"));
  const researchResult = await stepResearch(topic);
  await emit(
    phaseEvent("research", "done", `出典 ${researchResult.sources.length} 件を確保しました`)
  );

  // 4. outline
  await emit(phaseEvent("outline", "running", "構成を作成しています"));
  const outline = await stepOutline(topic, researchResult);
  await emit(phaseEvent("outline", "done", `${outline.sections.length} 節の構成ができました`));

  // 5. write
  await emit(phaseEvent("write", "running", "執筆しています"));
  const written = await stepWrite(topic, outline, researchResult);
  await emit(phaseEvent("write", "done", `${written.charCount} 字の下書きができました`));

  // 6. internal-links
  await emit(phaseEvent("internal-links", "running", "内部リンクを追加しています"));
  const linkedDraft = await stepInternalLinks(written, inventory.knownPaths);
  await emit(
    phaseEvent("internal-links", "done", `内部リンク ${linkedDraft.internalLinks.length} 本を追加しました`)
  );

  // 7. image-plan
  await emit(phaseEvent("image-plan", "running", "画像プランを作成しています"));
  const imagePlan = await stepImagePlan(topic, linkedDraft, researchResult);
  await emit(phaseEvent("image-plan", "done", "画像プランを作成しました（画像生成は行いません）"));

  // 変更セットを組み立てる
  const articlePath = `content/articles/${linkedDraft.slug}.md`;
  const imagePlanPath = `${ARTICLE_RUN_DIR}/${runId}-image-plan.md`;
  const changes: ArticleChange[] = [
    { path: articlePath, operation: "CREATE", content: buildArticleMarkdown(linkedDraft) },
    { path: imagePlanPath, operation: "CREATE", content: imagePlan },
  ];

  // 8. qa
  await emit(phaseEvent("qa", "running", "QAを実行しています"));
  const initialQa = await stepQa(
    linkedDraft,
    researchResult,
    inventory,
    changes.map((c) => c.path)
  );
  await emit(
    phaseEvent("qa", "running", `QA総合判定: ${initialQa.overall}（指摘 ${initialQa.issues.length} 件）`)
  );

  // ── QA判定と、sources限定の自動修復ループ ──
  //
  // sources 以外の FAIL があれば従来どおり即停止する。
  // sources だけが FAIL の場合に限り、追加検索と本文修正で修復を試みる。
  // 修復は最大 MAX_SOURCE_REPAIR_ATTEMPTS 回。上限に達したらPRを作らず停止する。
  let qa = initialQa;
  let draft = linkedDraft;
  let research = researchResult;
  let repairAttempts = 0;

  for (;;) {
    const decision = decideRepairAction(qa, research, repairAttempts);

    if (decision.action === "proceed") break;

    if (decision.action === "stop") {
      await emit({
        type: "blocked",
        phase: "qa",
        reason: decision.reason,
        code: decision.code,
        at: new Date().toISOString(),
      });
      return { runId, slug: draft.slug, status: "blocked", reason: decision.reason, qa, publish: null };
    }

    // decision.action === "repair"
    repairAttempts = decision.attempt;
    await emit(
      phaseEvent(
        "qa",
        "running",
        `出典の自動修復を試みています（${repairAttempts}/${MAX_SOURCE_REPAIR_ATTEMPTS}回目・対象 ${decision.claims.length} 件）`
      )
    );

    const repaired = await stepRepairSources(decision.claims, draft, research, {
      title: topic.title,
      primaryKeyword: topic.primaryKeyword,
    });

    await emit(
      phaseEvent(
        "qa",
        "running",
        `修復${repairAttempts}回目: 引用追加 ${repaired.citationsAdded} 件 / 本文修正 ${repaired.editsApplied} 件 / 主張取り下げ ${repaired.claimsDropped} 件` +
          (repaired.rejected.length > 0 ? ` / 却下 ${repaired.rejected.length} 件` : "") +
          (repaired.searchError ? ` / 追加検索エラー: ${repaired.searchError}` : "")
      )
    );

    draft = { ...draft, body: repaired.body, charCount: repaired.body.length };
    research = repaired.research;

    // 修復後は内部リンク・frontmatter・安全判定・出典判定をすべて再実行する
    draft = await stepRevalidateLinks(draft, inventory.knownPaths);
    qa = await stepQa(
      draft,
      research,
      inventory,
      changes.map((c) => c.path)
    );
    await emit(
      phaseEvent("qa", "running", `再QA（修復${repairAttempts}回目）: ${qa.overall}（指摘 ${qa.issues.length} 件）`)
    );
  }

  // 修復後の本文を変更セットへ反映する
  changes[0] = {
    path: articlePath,
    operation: "CREATE",
    content: buildArticleMarkdown(draft),
  };

  await emit(
    phaseEvent(
      "qa",
      "done",
      repairAttempts > 0
        ? `QA PASS（出典修復 ${repairAttempts} 回で解消）`
        : "QA PASS"
    )
  );


  // 9. create-pr
  // この時点ではQAのbuild判定が未確定なので、公開は保留のままPRを作る。
  await emit(phaseEvent("create-pr", "running", "Pull Requestを作成しています"));
  const created = await stepCreatePr(
    runId,
    topic,
    changes,
    qa,
    "PR検証（CI）の結果を待っています"
  );
  await emit(phaseEvent("create-pr", "done", `PR #${created.prNumber} を作成しました`));

  // 10. pr-validation — 外部CIとVercel Previewの結果を耐久的に待つ
  await emit(
    phaseEvent("pr-validation", "running", "CIとVercel Previewの結果を待っています")
  );

  const startedAt = Date.now();
  let checkDecision = await stepEvaluateChecks(created.prNumber, startedAt);

  // pending の間は sleep して再ポーリングする。sleep はワークフロー側で行う。
  while (checkDecision.decision.state === "pending") {
    await emit(phaseEvent("pr-validation", "running", checkDecision.decision.detail));
    await sleep(WAIT.checkPollInterval);
    checkDecision = await stepEvaluateChecks(created.prNumber, startedAt);
  }

  if (checkDecision.decision.state !== "passed") {
    const reason = checkDecision.decision.detail;
    await emit(phaseEvent("pr-validation", "failed", reason));
    await emit({
      type: "blocked",
      phase: "pr-validation",
      reason,
      code: `CHECKS_${checkDecision.decision.state.toUpperCase()}`,
      at: new Date().toISOString(),
    });
    await emit({
      type: "completed",
      prUrl: created.prUrl,
      prNumber: created.prNumber,
      productionUrl: null,
      published: false,
      at: new Date().toISOString(),
    });
    return {
      runId,
      slug: draft.slug,
      status: "blocked",
      reason,
      qa,
      publish: { ...created, headSha: checkDecision.headSha, publishBlockedReason: reason },
    };
  }

  await emit(phaseEvent("pr-validation", "done", "CIとVercel Previewが成功しました"));

  // CIが通ったので、はじめて buildPassed: true でQAを再評価する。
  // ローカルのbooleanではなく、外部CIの結果が根拠になっている。
  const verifiedQa = await stepQaWithBuild(
    draft,
    research,
    inventory,
    changes.map((c) => c.path),
    true
  );
  const autoPublishAuthorized = await stepIsAutoPublishAuthorized();
  const gate = canAutoPublish(verifiedQa, autoPublishAuthorized);

  // 11. publish（マージ）
  await emit(phaseEvent("publish", "running", "公開判定を行っています"));

  const mergeGate = await stepEvaluateMergeGate(
    created.prNumber,
    gate.allowed,
    gate.reason,
    checkDecision.decision
  );

  if (!mergeGate.allowed) {
    await emit(phaseEvent("publish", "skipped", mergeGate.reason));
    await emit({
      type: "completed",
      prUrl: created.prUrl,
      prNumber: created.prNumber,
      productionUrl: null,
      published: false,
      at: new Date().toISOString(),
    });
    return {
      runId,
      slug: draft.slug,
      status: "completed",
      reason: mergeGate.reason,
      qa: verifiedQa,
      publish: {
        ...created,
        headSha: checkDecision.headSha,
        publishBlockedReason: mergeGate.reason,
      },
    };
  }

  const mergeCommitSha = await stepMerge(created.prNumber);
  await emit(phaseEvent("publish", "done", `マージしました（${mergeCommitSha.slice(0, 7)}）`));

  // 12. production-deploy — マージコミットの本番デプロイ成功を待つ
  await emit(phaseEvent("production-deploy", "running", "本番デプロイの完了を待っています"));

  const deployStartedAt = Date.now();
  let deploy = await stepEvaluateDeployment(mergeCommitSha, deployStartedAt);

  while (deploy.state === "pending") {
    await emit(phaseEvent("production-deploy", "running", deploy.detail));
    await sleep(WAIT.deployPollInterval);
    deploy = await stepEvaluateDeployment(mergeCommitSha, deployStartedAt);
  }

  if (deploy.state !== "succeeded") {
    // マージはされたが公開の確認は取れていない。published: true にはしない。
    const reason = `${deploy.detail}（PRはマージ済みです）`;
    await emit(phaseEvent("production-deploy", "failed", reason));
    await emit({
      type: "blocked",
      phase: "production-deploy",
      reason,
      code: `DEPLOY_${deploy.state.toUpperCase()}`,
      at: new Date().toISOString(),
    });
    await emit({
      type: "completed",
      prUrl: created.prUrl,
      prNumber: created.prNumber,
      productionUrl: null,
      published: false,
      at: new Date().toISOString(),
    });
    return {
      runId,
      slug: draft.slug,
      status: "blocked",
      reason,
      qa: verifiedQa,
      publish: {
        ...created,
        headSha: checkDecision.headSha,
        mergeCommitSha,
        published: false,
        publishBlockedReason: reason,
      },
    };
  }

  // 本番デプロイの成功を確認できて、はじめて「公開した」と報告する。
  const productionUrl = deploy.url ?? `${SITE_URL}/articles/${draft.slug}`;
  await emit(phaseEvent("production-deploy", "done", "本番デプロイが成功しました"));
  await emit({
    type: "completed",
    prUrl: created.prUrl,
    prNumber: created.prNumber,
    productionUrl,
    published: true,
    at: new Date().toISOString(),
  });

  return {
    runId,
    slug: draft.slug,
    status: "completed",
    reason: null,
    qa: verifiedQa,
    publish: {
      ...created,
      headSha: checkDecision.headSha,
      mergeCommitSha,
      published: true,
      publishBlockedReason: null,
      productionUrl,
    },
  };
}
