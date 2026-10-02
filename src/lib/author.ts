/**
 * 著者（磯貝アルト）のプロフィール表記。
 *
 * 年齢は環境変数 AUTHOR_BIRTHDATE（YYYY-MM-DD）から日本時間の今日を基準に計算する。
 * 公開リポジトリに生年月日を載せないため、値はコードに書かず Vercel の環境変数で渡す。
 * 未設定・不正な値のときは年齢を出さない。
 *
 * ページは静的生成されるため、誕生日を過ぎた表示への切り替えは
 * 各ルートの revalidate（root layout で1日）に従う。
 */

const BIRTHDATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 日本時間での年月日 */
function tokyoDateParts(now: Date): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return { year, month, day };
}

/** 満年齢。birthdate が未設定・不正なら null */
export function getAuthorAge(
  now: Date = new Date(),
  birthdate: string | undefined = process.env.AUTHOR_BIRTHDATE
): number | null {
  const match = birthdate?.trim().match(BIRTHDATE_PATTERN);
  if (!match) return null;
  const [birthYear, birthMonth, birthDay] = match.slice(1).map(Number);
  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null;

  const today = tokyoDateParts(now);
  const hadBirthday =
    today.month > birthMonth || (today.month === birthMonth && today.day >= birthDay);
  const age = today.year - birthYear - (hadBirthday ? 0 : 1);
  return age >= 0 ? age : null;
}

/** 「25歳・転職1回」。年齢が出せないときは「転職1回」 */
export function getAuthorProfileLabel(now?: Date, birthdate?: string): string {
  const age = getAuthorAge(now, birthdate ?? process.env.AUTHOR_BIRTHDATE);
  return age === null ? "転職1回" : `${age}歳・転職1回`;
}
