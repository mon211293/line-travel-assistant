import type { AppConfig } from "./config";
import { getTodayEvents, type CalendarEvent } from "./calendar";
import type { TripConfig } from "./tripConfig";
import { getDateKey } from "./timeZoneUtil";
import { findCity } from "./cities";
import { getTodayWeather, formatWeatherText } from "./weather";

export function formatDateLabel(date: Date, timeZone: string): string {
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

/** 今天的行程區塊;今天沒有行程就回傳 null。 */
export async function buildItinerarySection(config: AppConfig, timeZone: string, now: Date): Promise<string | null> {
  const events = await getTodayEvents(config, timeZone, now);
  if (events.length === 0) return null;
  return ["【今日行程】", "", events.map((e) => formatEventLine(e, timeZone)).join("\n\n")].join("\n");
}

/** 今天所在城市的天氣區塊;那天沒設定城市就回傳 null。 */
export async function buildWeatherSection(tripConfig: TripConfig | null, timeZone: string, now: Date): Promise<string | null> {
  const cityRef = tripConfig?.cityByDate[getDateKey(now, timeZone)];
  if (!cityRef) return null;
  const city = findCity(cityRef.country, cityRef.city);
  if (!city) return null;
  return formatWeatherText(city, await getTodayWeather(city, timeZone));
}
