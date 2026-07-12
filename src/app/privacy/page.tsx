import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "NARUのプライバシーポリシー。個人情報の取り扱い、Cookie、広告についての方針を記載しています。",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "ホーム", href: "/" },
          { name: "プライバシーポリシー", href: "/privacy" },
        ]}
      />
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-2xl md:text-3xl font-semibold mb-8">
          プライバシーポリシー
        </h1>
        <div className="prose">
          <p>
            NARU（以下「当サイト」）は、ユーザーの個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>

          <h2>個人情報の収集について</h2>
          <p>
            当サイトでは、お問い合わせの際にお名前・メールアドレス等の個人情報をご提供いただく場合があります。これらの情報は、お問い合わせへの回答にのみ使用し、それ以外の目的では利用いたしません。
          </p>

          <h2>アクセス解析ツールについて</h2>
          <p>
            当サイトでは、Googleによるアクセス解析ツール「Google Analytics 4」を使用しています。Google Analytics 4はCookieを使用してデータを収集しますが、このデータは匿名で収集されており、個人を特定するものではありません。
          </p>
          <p>
            データ収集を無効にしたい場合は、ブラウザの設定でCookieを無効にすることで対応できます。詳細は
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
            >
              Googleのポリシーと規約
            </a>
            をご確認ください。
          </p>

          <h2 id="ads">広告について</h2>
          <p>
            当サイトは、一部の記事においてアフィリエイトプログラム（成果報酬型広告）を利用しています。当サイトのリンクから商品・サービスにお申し込みいただいた場合、当サイト運営者に成果報酬が支払われることがあります。
          </p>
          <p>
            ただし、広告の有無や報酬額が記事の内容・評価・ランキングに影響を与えることは一切ありません。記事内のサービス紹介・比較はすべて著者の実体験に基づいて作成しています。
          </p>
          <p>
            アフィリエイトリンクを含む記事には、記事冒頭に「本記事はプロモーションを含みます」と明記しています。
          </p>

          <h2>免責事項</h2>
          <p>
            当サイトに掲載されている情報の正確性には万全を期しておりますが、情報が古くなっている場合や、誤りが含まれている場合があります。当サイトの情報を利用することで生じたいかなる損害についても、当サイトは責任を負いかねます。
          </p>

          <h2>著作権について</h2>
          <p>
            当サイトに掲載されている文章・画像等のコンテンツの著作権は、当サイト運営者に帰属します。無断での転載・複製はご遠慮ください。
          </p>

          <h2>プライバシーポリシーの変更</h2>
          <p>
            当サイトは、必要に応じてプライバシーポリシーを変更することがあります。変更後のポリシーは当ページに掲載した時点で効力を生じるものとします。
          </p>

          <p className="text-ink-soft text-sm mt-8">
            制定日: 2026年7月10日
            <br />
            最終更新日: 2026年7月12日
          </p>
        </div>
      </div>
    </>
  );
}
