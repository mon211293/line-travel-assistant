import type { Request, Response } from "@google-cloud/functions-framework";
import { getTripConfig, setTripConfig, type TripConfig, type ScheduledMessage, type AutoReply } from "./tripConfig";
import { findCity } from "./cities";
import { verifyLiffIdToken } from "./liffAuth";
import { isKnownTimeZone } from "./timeZoneUtil";

/** 這個設定頁只有旅遊管家的擁有者能看/能改,其他加這個 LINE 官方帳號為好友的人一律擋掉。 */
async function authenticateOwner(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) return false;

  const userId = await verifyLiffIdToken(authHeader.slice("Bearer ".length));
  const ownerUserId = process.env.OWNER_USER_ID;
  return typeof userId === "string" && typeof ownerUserId === "string" && userId === ownerUserId;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function parseTripConfigInput(body: unknown): TripConfig | null {
  const b = body as Record<string, unknown>;
  if (typeof b.startDate !== "string" || !DATE_PATTERN.test(b.startDate)) return null;
  if (typeof b.endDate !== "string" || !DATE_PATTERN.test(b.endDate)) return null;
  if (b.startDate > b.endDate) return null;
  if (b.weatherTime !== undefined && (typeof b.weatherTime !== "string" || !TIME_PATTERN.test(b.weatherTime))) return null;
  if (b.timezone !== undefined && (typeof b.timezone !== "string" || !isKnownTimeZone(b.timezone))) return null;

  const cityByDateRaw = b.cityByDate as Record<string, { country?: unknown; city?: unknown }> | undefined;
  const cityByDate: TripConfig["cityByDate"] = {};
  if (cityByDateRaw && typeof cityByDateRaw === "object") {
    for (const [dateKey, ref] of Object.entries(cityByDateRaw)) {
      if (!DATE_PATTERN.test(dateKey) || dateKey < b.startDate || dateKey > b.endDate) continue;
      if (typeof ref?.country !== "string" || typeof ref?.city !== "string") continue;
      if (!findCity(ref.country, ref.city)) continue;
      cityByDate[dateKey] = { country: ref.country, city: ref.city };
    }
  }

  const scheduledMessagesRaw = Array.isArray(b.scheduledMessages) ? b.scheduledMessages : [];
  const scheduledMessages: ScheduledMessage[] = [];
  for (const item of scheduledMessagesRaw as unknown[]) {
    const m = item as Record<string, unknown>;
    if (typeof m.id !== "string" || m.id.length === 0) continue;
    if (typeof m.date !== "string" || !DATE_PATTERN.test(m.date)) continue;
    if (typeof m.time !== "string" || !TIME_PATTERN.test(m.time)) continue;
    if (typeof m.text !== "string" || m.text.trim().length === 0) continue;
    scheduledMessages.push({ id: m.id, date: m.date, time: m.time, text: m.text.trim() });
  }

  const autoRepliesRaw = Array.isArray(b.autoReplies) ? b.autoReplies : [];
  const autoReplies: AutoReply[] = [];
  for (const item of autoRepliesRaw as unknown[]) {
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.length === 0) continue;
    if (typeof r.keyword !== "string" || r.keyword.trim().length === 0 || r.keyword.trim().length > 30) continue;
    if (typeof r.text !== "string" || r.text.trim().length === 0 || r.text.length > 5000) continue;
    if (r.fromDate !== undefined && r.fromDate !== "" && (typeof r.fromDate !== "string" || !DATE_PATTERN.test(r.fromDate))) continue;
    // Firestore 不接受 undefined 欄位,沒填日期就整個欄位省略。
    const reply: AutoReply = { id: r.id, keyword: r.keyword.trim(), text: r.text.trim() };
    if (typeof r.fromDate === "string" && r.fromDate) reply.fromDate = r.fromDate;
    autoReplies.push(reply);
  }

  return {
    startDate: b.startDate,
    endDate: b.endDate,
    timezone: typeof b.timezone === "string" ? b.timezone : undefined,
    weatherTime: typeof b.weatherTime === "string" ? b.weatherTime : undefined,
    cityByDate,
    scheduledMessages,
    autoReplies,
  };
}

export async function handleTripConfigApi(req: Request, res: Response): Promise<void> {
  if (!(await authenticateOwner(req))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({ config: await getTripConfig() });
    return;
  }

  if (req.method === "PUT") {
    const parsed = parseTripConfigInput(req.body);
    if (!parsed) {
      res.status(400).json({ error: "invalid body" });
      return;
    }
    await setTripConfig(parsed);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
}
