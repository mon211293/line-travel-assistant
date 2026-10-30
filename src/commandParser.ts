export type Command =
  | { type: "itinerary"; dateKey: string }
  | { type: "weather"; dateKey: string }
  | { type: "next" }
  | { type: "navigate" }
  | { type: "help" };

/** dateKey(YYYY-MM-DD)加減天數。用 UTC 日期運算,避免執行環境時區造成差一天。 */
export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const RELATIVE_DAYS: Record<string, number> = { 今天: 0, 明天: 1, 後天: 2, 大後天: 3, 昨天: -1 };
const DATE_COMMAND = /^(今天|明天|後天|大後天|昨天|\d{1,2}[\/月]\d{1,2}[日號]?)\s*(行程|天氣)$/;

function resolveDate(token: string, todayKey: string, tripStartDate?: string): string | null {
  if (token in RELATIVE_DAYS) return addDays(todayKey, RELATIVE_DAYS[token]);

  const m = token.match(/^(\d{1,2})[\/月](\d{1,2})[日號]?$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // 沒寫年份時以行程開始日的年份為準;若日期比開始日早,代表跨年(例如 12 月出發、隔年 1 月回來)。
  const baseYear = Number((tripStartDate ?? todayKey).slice(0, 4));
  const build = (year: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  let candidate = build(baseYear);
  if (tripStartDate && candidate < tripStartDate) candidate = build(baseYear + 1);

  // 擋掉 2/30 這種不存在的日期(Date 會自動進位,進位後 round-trip 就對不上了)。
  const check = new Date(`${candidate}T00:00:00Z`);
  return check.getUTCMonth() + 1 === month && check.getUTCDate() === day ? candidate : null;
}

/** 把群組裡的一句話解析成指令;不是指令就回傳 null(機器人不回,避免打擾一般聊天)。
 * 一律要求整句完全符合,所以「今天行程好多」這種聊天內容不會誤觸發。 */
export function parseCommand(text: string, todayKey: string, tripStartDate?: string): Command | null {
  if (text === "行程") return { type: "itinerary", dateKey: todayKey };
  if (text === "天氣") return { type: "weather", dateKey: todayKey };
  if (text === "下一個行程" || text === "下個行程") return { type: "next" };
  if (text === "導航") return { type: "navigate" };
  if (text === "指令" || text === "說明") return { type: "help" };

  const m = text.match(DATE_COMMAND);
  if (!m) return null;
  const dateKey = resolveDate(m[1], todayKey, tripStartDate);
  if (!dateKey) return null;
  return { type: m[2] === "行程" ? "itinerary" : "weather", dateKey };
}
