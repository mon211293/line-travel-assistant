import * as functions from "@google-cloud/functions-framework";
import { loadConfig, type AppConfig } from "./config";
import { pushText } from "./line";
import { isAuthorizedTrigger } from "./httpAuth";
import { getTripConfig, isWithinTrip, isPastDailyTime, getTimeZone } from "./tripConfig";
import { getDateKey, getTimeOfDay } from "./timeZoneUtil";
import { hasSentDailyToday, markDailySent } from "./dailySentStore";
import { buildItinerarySection, formatDateLabel } from "./dailyContent";

// 每 15 分鐘由排程觸發一次:到了使用者設定的每日推播時間,就推播一則「今日行程」總覽
// (一天只佔一則推播額度),並用 Firestore 記錄今天已發送,避免重複。
// 天氣不主動推播,改成有人在群組輸入「天氣」時由 travelWebhook 免費回覆。
export async function dailyItinerary(config: AppConfig): Promise<void> {
  const tripConfig = await getTripConfig();
  if (!tripConfig) return;

  const timeZone = getTimeZone(tripConfig);
  const now = new Date();
  const dateKey = getDateKey(now, timeZone);

  if (!isWithinTrip(tripConfig, dateKey)) return;
  if (!isPastDailyTime(tripConfig, getTimeOfDay(now, timeZone))) return;
  if (await hasSentDailyToday(dateKey)) return;

  const itinerary = await buildItinerarySection(config, timeZone, now);
  if (!itinerary) return; // 今天沒有行程:不打擾群組

  await pushText(config, [`🧳 ${formatDateLabel(now, timeZone)}`, itinerary].join("\n\n"));
  await markDailySent(dateKey);
}

functions.http("dailyItinerary", async (req, res) => {
  try {
    const config = await loadConfig();
    if (!isAuthorizedTrigger(req, config)) {
      res.status(401).send("Unauthorized");
      return;
    }

    await dailyItinerary(config);
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send(err instanceof Error ? err.message : "Unknown error");
  }
});
