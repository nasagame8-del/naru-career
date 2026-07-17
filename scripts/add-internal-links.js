/**
 * 全記事に「あわせて読みたい記事」セクションを追加するスクリプト
 */
const fs = require("fs");
const path = require("path");

const articlesDir = path.join(__dirname, "..", "content", "articles");

// 記事間の関連リンクマッピング（各記事に2-3本）
const linkMap = {
  // ── 体験談（12本） ──
  "second-new-grad-it-career-change": [
    { slug: "job-change-timing-3months", title: "第二新卒の転職タイミング、実際に僕が動いた3ヶ月間の記録" },
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
    { slug: "what-is-second-new-grad", title: "第二新卒とは？定義・年齢/年数の目安" },
  ],
  "web-industry-guide": [
    { slug: "it-web-industry-real-work-culture", title: "IT/Web業界のリアルな働き方・文化" },
    { slug: "aio-seo-industry-inside", title: "AIO対策企業に営業職で入社。マーケティングを独学した話" },
    { slug: "what-is-web-industry", title: "Web業界とは？未経験から目指す人が知っておくべき職種・働き方" },
  ],
  "agent-referral-vs-self-apply": [
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
    { slug: "agent-site-vs-agent-usage", title: "転職サイトとエージェント、両方使って分かった使い分け方" },
    { slug: "recruitment-agency-business-model", title: "人材紹介の仕組みを解説——エージェントはなぜ無料なのか" },
  ],
  "bizreach-second-new-grad": [
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
    { slug: "direct-recruiting", title: "ダイレクトリクルーティングとは？スカウト型転職の仕組み" },
    { slug: "agent-referral-vs-self-apply", title: "エージェント紹介 vs 自己応募、内定に近かったのは？" },
  ],
  "interview-failure-why-this-job": [
    { slug: "resume-writing-second-new-grad", title: "職務経歴書、第二新卒はここで差がつく" },
    { slug: "second-new-grad-job-change-traps", title: "第二新卒が陥りやすい転職の罠と回避策" },
    { slug: "casual-interview", title: "カジュアル面談とは？本選考との違いと活用法" },
  ],
  "resume-writing-second-new-grad": [
    { slug: "interview-failure-why-this-job", title: "面接で「なぜこの職種を志望するのか」と聞かれて詰まった話" },
    { slug: "second-new-grad-it-career-change", title: "第二新卒がIT業界に転職するための完全ガイド" },
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
  ],
  "how-to-resign-experience": [
    { slug: "second-new-grad-retirement-pay", title: "第二新卒に退職金は出ない？知らないと損する制度の話" },
    { slug: "job-change-timing-3months", title: "第二新卒の転職タイミング、僕が動いた3ヶ月間の記録" },
    { slug: "second-new-grad-job-change-traps", title: "第二新卒が陥りやすい転職の罠と回避策" },
  ],
  "it-industry-quit-myth": [
    { slug: "it-web-industry-real-work-culture", title: "IT/Web業界のリアルな働き方・文化" },
    { slug: "what-is-web-industry", title: "Web業界とは？未経験から目指す人が知っておくべき職種" },
    { slug: "second-new-grad-programming-career-change", title: "プログラミング未経験でもIT転職できる？" },
  ],
  "it-web-industry-real-work-culture": [
    { slug: "web-industry-guide", title: "AIO対策の会社で働くってどんな仕事？未経験入社のリアル" },
    { slug: "aio-seo-industry-inside", title: "AIO対策企業に営業職で入社。マーケティングを独学した話" },
    { slug: "it-industry-quit-myth", title: "「IT業界はやめとけ」と言われて転職した僕が思うこと" },
  ],
  "job-change-timing-3months": [
    { slug: "second-new-grad-it-career-change", title: "第二新卒がIT業界に転職するための完全ガイド" },
    { slug: "how-to-resign-experience", title: "退職の伝え方、有給・ボーナスはどうだった？" },
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
  ],
  "second-new-grad-job-change-traps": [
    { slug: "interview-failure-why-this-job", title: "面接で「なぜこの職種を志望するのか」と聞かれて詰まった話" },
    { slug: "how-to-resign-experience", title: "退職の伝え方、有給・ボーナスはどうだった？" },
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
  ],
  "second-new-grad-programming-career-change": [
    { slug: "second-new-grad-it-career-change", title: "第二新卒がIT業界に転職するための完全ガイド" },
    { slug: "it-industry-quit-myth", title: "「IT業界はやめとけ」と言われて転職した僕が思うこと" },
    { slug: "skill-based-hiring", title: "スキルベース採用とは？学歴より実力で評価される時代" },
  ],

  // ── エージェント比較（2本） ──
  "agent-comparison-2026": [
    { slug: "agent-site-vs-agent-usage", title: "転職サイトとエージェント、両方使って分かった使い分け方" },
    { slug: "agent-referral-vs-self-apply", title: "エージェント紹介 vs 自己応募、内定に近かったのは？" },
    { slug: "recruitment-agency-business-model", title: "人材紹介の仕組みを解説——エージェントはなぜ無料なのか" },
  ],
  "agent-site-vs-agent-usage": [
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
    { slug: "bizreach-second-new-grad", title: "ビズリーチは第二新卒でも使える？実際に登録してみた結果" },
    { slug: "agent-free-and-cancel", title: "転職エージェントは本当に無料？途中で断ってもいい？" },
  ],

  // ── 業界解説（12本） ──
  "what-is-second-new-grad": [
    { slug: "second-new-grad-it-career-change", title: "第二新卒がIT業界に転職するための完全ガイド" },
    { slug: "second-new-grad-retirement-pay", title: "第二新卒に退職金は出ない？知らないと損する制度の話" },
    { slug: "job-change-timing-3months", title: "第二新卒の転職タイミング、僕が動いた3ヶ月間の記録" },
  ],
  "what-is-web-industry": [
    { slug: "it-web-industry-real-work-culture", title: "IT/Web業界のリアルな働き方・文化" },
    { slug: "web-industry-guide", title: "AIO対策の会社で働くってどんな仕事？未経験入社のリアル" },
    { slug: "second-new-grad-programming-career-change", title: "プログラミング未経験でもIT転職できる？" },
  ],
  "recruitment-agency-business-model": [
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
    { slug: "agent-free-and-cancel", title: "転職エージェントは本当に無料？途中で断ってもいい？" },
    { slug: "agent-referral-vs-self-apply", title: "エージェント紹介 vs 自己応募、内定に近かったのは？" },
  ],
  "agent-free-and-cancel": [
    { slug: "recruitment-agency-business-model", title: "人材紹介の仕組みを解説——エージェントはなぜ無料なのか" },
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
    { slug: "agent-site-vs-agent-usage", title: "転職サイトとエージェント、両方使って分かった使い分け方" },
  ],
  "aio-seo-industry-inside": [
    { slug: "web-industry-guide", title: "AIO対策の会社で働くってどんな仕事？未経験入社のリアル" },
    { slug: "it-web-industry-real-work-culture", title: "IT/Web業界のリアルな働き方・文化" },
    { slug: "what-is-web-industry", title: "Web業界とは？未経験から目指す人が知っておくべき職種" },
  ],
  "second-new-grad-retirement-pay": [
    { slug: "how-to-resign-experience", title: "退職の伝え方、有給・ボーナスはどうだった？" },
    { slug: "what-is-second-new-grad", title: "第二新卒とは？定義・年齢/年数の目安" },
    { slug: "job-change-timing-3months", title: "第二新卒の転職タイミング、僕が動いた3ヶ月間の記録" },
  ],
  // 新シリーズ6本
  "referral-hiring": [
    { slug: "agent-referral-vs-self-apply", title: "エージェント紹介 vs 自己応募、内定に近かったのは？" },
    { slug: "alumni-hiring", title: "アルムナイ採用とは？一度辞めた会社に戻れる時代" },
    { slug: "direct-recruiting", title: "ダイレクトリクルーティングとは？スカウト型転職の仕組み" },
  ],
  "alumni-hiring": [
    { slug: "referral-hiring", title: "リファラル採用とは？社員紹介の仕組みと注意点" },
    { slug: "how-to-resign-experience", title: "退職の伝え方、有給・ボーナスはどうだった？" },
    { slug: "what-is-second-new-grad", title: "第二新卒とは？定義・年齢/年数の目安" },
  ],
  "direct-recruiting": [
    { slug: "bizreach-second-new-grad", title: "ビズリーチは第二新卒でも使える？実際に登録してみた結果" },
    { slug: "agent-comparison-2026", title: "【実体験】第二新卒の転職で使ったエージェント比較" },
    { slug: "referral-hiring", title: "リファラル採用とは？社員紹介の仕組みと注意点" },
  ],
  "casual-interview": [
    { slug: "interview-failure-why-this-job", title: "面接で「なぜこの職種を志望するのか」と聞かれて詰まった話" },
    { slug: "direct-recruiting", title: "ダイレクトリクルーティングとは？スカウト型転職の仕組み" },
    { slug: "resume-writing-second-new-grad", title: "職務経歴書、第二新卒はここで差がつく" },
  ],
  "skill-based-hiring": [
    { slug: "second-new-grad-programming-career-change", title: "プログラミング未経験でもIT転職できる？" },
    { slug: "resume-writing-second-new-grad", title: "職務経歴書、第二新卒はここで差がつく" },
    { slug: "what-is-web-industry", title: "Web業界とは？未経験から目指す人が知っておくべき職種" },
  ],
  "ai-interview-screening": [
    { slug: "interview-failure-why-this-job", title: "面接で「なぜこの職種を志望するのか」と聞かれて詰まった話" },
    { slug: "casual-interview", title: "カジュアル面談とは？本選考との違いと活用法" },
    { slug: "skill-based-hiring", title: "スキルベース採用とは？学歴より実力で評価される時代" },
  ],
};

function addLinks(slug) {
  const links = linkMap[slug];
  if (!links) return false;

  const filePath = path.join(articlesDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, "utf-8");

  // 既に「あわせて読みたい」セクションがあればスキップ
  if (content.includes("あわせて読みたい")) {
    console.log(`[SKIP] ${slug}: 既にリンクセクションあり`);
    return false;
  }

  // リンクセクションを作成
  const linkSection = `\n## あわせて読みたい記事\n\n${links
    .map((l) => `- [${l.title}](/articles/${l.slug})`)
    .join("\n")}\n`;

  // 挿入位置: 「## よくある質問」の前、なければ末尾
  const faqIndex = content.indexOf("\n## よくある質問");
  if (faqIndex !== -1) {
    content = content.slice(0, faqIndex) + linkSection + content.slice(faqIndex);
  } else {
    // まとめセクションの前に入れる
    const matomeMatch = content.match(/\n## まとめ/);
    if (matomeMatch) {
      const matomeIndex = content.indexOf(matomeMatch[0]);
      content = content.slice(0, matomeIndex) + linkSection + content.slice(matomeIndex);
    } else {
      // 末尾に追加
      content = content.trimEnd() + "\n" + linkSection;
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`[OK] ${slug}: ${links.length}本のリンクを追加`);
  return true;
}

let count = 0;
for (const slug of Object.keys(linkMap)) {
  if (addLinks(slug)) count++;
}
console.log(`\n[完了] ${count}記事にリンクを追加`);
