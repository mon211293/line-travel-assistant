import * as functions from "@google-cloud/functions-framework";
import { loadConfig, type AppConfig } from "./config";
import { getTodayEvents, type CalendarEvent } from "./calendar";
import { pushText } from "./line";
import { isAuthorizedTrigger } from "./httpAuth";
import { getTripConfig, isWithinTrip, getTimeZone } from "./tripConfig";
import { getDateKey } from "./timeZoneUtil";

function formatDateLabel(date: Date, timeZone: string): string {
  return date.toLocaleDateString("zh-TW", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function formatEventLine(event: CalendarEvent, timeZone: string): string {
  const header = event.allDay
    ? `・${event.title}(全天)`
    : `・${event.start.toLocaleTimeString("zh-TW", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })} ${event.title}`;

  const detailLines: string[] = [];
  if (event.location) detailLines.push(`    📍 ${event.location}`);
  if (event.description) detailLines.push(`    📝 ${event.description}`);

  return [header, ...detailLines].join("\n");
}

function buildTextSummary(dateLabel: string, events: CalendarEvent[], timeZone: string): string {
  return [`🧳 ${dateLabel}`, "", "【今日行程】", "", events.map((e) => formatEventLine(e, timeZone)).join("\n\n")].join("\n");
}

export async function dailyItinerary(config: AppConfig): Promise<void> {
  const tripConfig = await getTripConfig();
  const timeZone = getTimeZone(tripConfig);

  const now = new Date();
  const dateKey = getDateKey(now, timeZone);

  if (!isWithinTrip(tripConfig, dateKey)) {
    console.log("今天不在行程日期範圍內,跳過推播");
    return;
  }

  const events = await getTodayEvents(config, timeZone, now);
  if (events.length === 0) {
    console.log("今天沒有行程,跳過推播(避免打擾群組)");
    return;
  }

  const dateLabel = formatDateLabel(now, timeZone);
  await pushText(config, buildTextSummary(dateLabel, events, timeZone));
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
