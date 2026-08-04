import * as functions from "@google-cloud/functions-framework";
import { loadConfig, type AppConfig } from "./config";
import { pushText } from "./line";
import { isAuthorizedTrigger } from "./httpAuth";
import { getTripConfig, isWithinTrip, isPastWeatherTime } from "./tripConfig";
import { findCity } from "./cities";
import { getTodayWeather, formatWeatherText } from "./weather";
import { hasSentWeatherToday, markWeatherSent } from "./weatherSentStore";

const TOKYO_TIME_ZONE = "Asia/Tokyo";

function getTokyoDateKey(day: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TOKYO_TIME_ZONE }).format(day);
}

function getTokyoTimeOfDay(day: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TOKYO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(day);
}

// 每 15 分鐘由排程觸發一次(跟 itineraryReminder 共用同一個排程頻率),
// 檢查是否到了使用者設定的天氣推播時間,到了才發送,並用 Firestore 記錄today已發送過,避免重複推播。
export async function weatherPush(config: AppConfig): Promise<void> {
  const now = new Date();
  const dateKey = getTokyoDateKey(now);

  const tripConfig = await getTripConfig();
  if (!tripConfig || !isWithinTrip(tripConfig, dateKey)) return;
  if (!isPastWeatherTime(tripConfig, getTokyoTimeOfDay(now))) return;
  if (await hasSentWeatherToday(dateKey)) return;

  const city = findCity(tripConfig.country, tripConfig.city);
  if (!city) return;

  const weather = await getTodayWeather(city, TOKYO_TIME_ZONE);
  await pushText(config, formatWeatherText(city, weather));
  await markWeatherSent(dateKey);
}

functions.http("weatherPush", async (req, res) => {
  try {
    const config = await loadConfig();
    if (!isAuthorizedTrigger(req, config)) {
      res.status(401).send("Unauthorized");
      return;
    }

    await weatherPush(config);
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send(err instanceof Error ? err.message : "Unknown error");
  }
});
