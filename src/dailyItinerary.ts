import * as functions from "@google-cloud/functions-framework";
import { loadConfig, type AppConfig } from "./config";
import { getTodayEvents, type CalendarEvent } from "./calendar";
import { pushText } from "./line";
import { isAuthorizedTrigger } from "./httpAuth";
import { getTripConfig, isWithinTrip } from "./tripConfig";
import { findCity } from "./cities";
import { getTodayWeather, formatWeatherText } from "./weather";

const TOKYO_TIME_ZONE = "Asia/Tokyo";

function getTokyoDateKey(day: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TOKYO_TIME_ZONE }).format(day);
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("zh-TW", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function formatEventLine(event: CalendarEvent): string {
  const header = event.allDay
    ? `・${event.title}(全天)`
    : `・${event.start.toLocaleTimeString("zh-TW", {
        timeZone: TOKYO_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })} ${event.title}`;

  const detailLines: string[] = [];
  if (event.location) detailLines.push(`    📍 ${event.location}`);
  if (event.description) detailLines.push(`    📝 ${event.description}`);

  return [header, ...detailLines].join("\n");
}

function buildTextSummary(dateLabel: string, events: CalendarEvent[]): string {
  return [`🧳 ${dateLabel}`, "", "【今日行程】", "", events.map(formatEventLine).join("\n\n")].join("\n");
}

export async function dailyItinerary(config: AppConfig): Promise<void> {
  const now = new Date();
  const dateKey = getTokyoDateKey(now);

  const tripConfig = await getTripConfig();
  if (!isWithinTrip(tripConfig, dateKey)) {
    console.log("今天不在行程日期範圍內,跳過推播");
    return;
  }

  const events = await getTodayEvents(config, now);
  if (events.length === 0) {
    console.log("今天沒有行程,跳過推播(避免打擾群組)");
    return;
  }

  const dateLabel = formatDateLabel(now);
  await pushText(config, buildTextSummary(dateLabel, events));

  const city = findCity(tripConfig!.country, tripConfig!.city);
  if (city) {
    try {
      const weather = await getTodayWeather(city, TOKYO_TIME_ZONE);
      await pushText(config, formatWeatherText(city, weather));
    } catch (err) {
      console.error("查詢天氣失敗,略過天氣推播", err);
    }
  }
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
