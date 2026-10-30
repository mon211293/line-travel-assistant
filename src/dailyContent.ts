import type { AppConfig } from "./config";
import { getTodayEvents, type CalendarEvent } from "./calendar";
import type { TripConfig } from "./tripConfig";
import { findCity } from "./cities";
import { getDayWeather, formatWeatherText } from "./weather";

export function formatDateLabel(date: Date, timeZone: string): string {
  return date.toLocaleDateString("zh-TW", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

/** 地點轉成 Google Maps 搜尋連結,在 LINE 裡點一下就能導航。地點本身已經是網址就不再包一層。 */
export function mapsUrl(location: string): string | null {
  if (/^https?:\/\//.test(location.trim())) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function formatEventLine(event: CalendarEvent, timeZone: string): string {
  const header = event.allDay
    ? `・${event.title}(全天)`
    : `・${event.start.toLocaleTimeString("zh-TW", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })} ${event.title}`;

  const detailLines: string[] = [];
  if (event.location) {
    detailLines.push(`    📍 ${event.location}`);
    const url = mapsUrl(event.location);
    if (url) detailLines.push(`    🗺 ${url}`);
  }
  if (event.description) detailLines.push(`    📝 ${event.description}`);

  return [header, ...detailLines].join("\n");
}

/** 某一天的行程區塊;那天沒有行程就回傳 null。 */
export async function buildItinerarySection(config: AppConfig, timeZone: string, day: Date, title = "今日行程"): Promise<string | null> {
  const events = await getTodayEvents(config, timeZone, day);
  if (events.length === 0) return null;
  return [`【${title}】`, "", events.map((e) => formatEventLine(e, timeZone)).join("\n\n")].join("\n");
}

/** 某一天(dateKey)所在城市的天氣區塊;那天沒設定城市就回傳 null。 */
export async function buildWeatherSection(tripConfig: TripConfig | null, timeZone: string, dateKey: string, dayLabel = "今日"): Promise<string | null> {
  const cityRef = tripConfig?.cityByDate[dateKey];
  if (!cityRef) return null;
  const city = findCity(cityRef.country, cityRef.city);
  if (!city) return null;
  return formatWeatherText(city, await getDayWeather(city, timeZone, dateKey), dayLabel);
}
