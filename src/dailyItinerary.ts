import * as functions from "@google-cloud/functions-framework";
import { loadConfig, type AppConfig } from "./config";
import { pushText } from "./line";
import { isAuthorizedTrigger } from "./httpAuth";
import { getTripConfig, isWithinTrip, isPastDailyTime, getTimeZone } from "./tripConfig";
import { getDateKey, getTimeOfDay } from "./timeZoneUtil";
import { hasSentDailyToday, markDailySent } from "./dailySentStore";
import { buildItinerarySection, buildWeatherSection, formatDateLabel } from "./dailyContent";

// 每 15 分鐘由排程觸發一次:到了使用者設定的每日推播時間,就把「今日行程」加上「當地天氣與提醒」
// 合併成一則推播(一天只佔一則推播額度),並用 Firestore 記錄今天已發送,避免重複。
// 今天沒有行程就整則不發(即使有天氣),避免浪費額度。
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

  // 天氣查詢失敗(例如 Open-Meteo 暫時掛掉)不該害行程發不出去,這次就只發行程。
  const weather = await buildWeatherSection(tripConfig, timeZone, dateKey).catch((err) => {
    console.error("天氣查詢失敗,這次只發行程", err);
    return null;
  });

  const sections = [itinerary, weather].filter((s): s is string => s !== null);
  await pushText(config, [`🧳 ${formatDateLabel(now, timeZone)}`, ...sections].join("\n\n"));
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
