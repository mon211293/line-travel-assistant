import { google } from "googleapis";
import type { AppConfig } from "./config";
import { getDateKey, getUtcOffsetString } from "./timeZoneUtil";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  description?: string;
}

function buildOAuthClient(config: AppConfig) {
  const client = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret);
  client.setCredentials({ refresh_token: config.google.refreshToken });
  return client;
}

function toCalendarEvent(event: {
  id?: string | null;
  summary?: string | null;
  location?: string | null;
  description?: string | null;
  start?: { date?: string | null; dateTime?: string | null } | null;
  end?: { date?: string | null; dateTime?: string | null } | null;
}): CalendarEvent {
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = new Date((event.start?.dateTime ?? event.start?.date) as string);
  const end = new Date((event.end?.dateTime ?? event.end?.date) as string);
  return {
    id: event.id ?? "",
    title: event.summary ?? "(無標題)",
    start,
    end,
    allDay,
    location: event.location ?? undefined,
    description: event.description ?? undefined,
  };
}

async function listEvents(
  config: AppConfig,
  params: { timeMin: string; timeMax: string }
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: "v3", auth: buildOAuthClient(config) });

  const res = await calendar.events.list({
    calendarId: config.calendarId,
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items ?? []).map(toCalendarEvent);
}

/** 取得指定日期(預設今天,依 timeZone 判斷)當天這個旅行行事曆的事件,依開始時間排序。
 * Cloud Functions 執行環境的系統時區是 UTC,不能直接用 Date 的 setHours 算「當地日期」的起訖,
 * 否則在當地時間清晨觸發時,UTC 當下其實還是前一天,會抓到錯的一天。 */
export async function getTodayEvents(config: AppConfig, timeZone: string, day: Date = new Date()): Promise<CalendarEvent[]> {
  const dateKey = getDateKey(day, timeZone);
  const offset = getUtcOffsetString(day, timeZone);
  const startOfDay = new Date(`${dateKey}T00:00:00${offset}`);
  const endOfDay = new Date(`${dateKey}T23:59:59.999${offset}`);

  return listEvents(config, {
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
  });
}

const NEXT_EVENT_LOOKAHEAD_DAYS = 30;

/** 取得現在之後最近一個還沒開始的(非全天)事件,最多往後看 30 天;沒有就回傳 null。
 * 只列出「還沒開始」的,因為 events.list 會把進行中的事件也列出來(它依結束時間過濾)。 */
export async function getNextEvents(config: AppConfig): Promise<CalendarEvent[]> {
  const now = new Date();
  const events = await listEvents(config, {
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + NEXT_EVENT_LOOKAHEAD_DAYS * 24 * 60 * 60_000).toISOString(),
  });
  return events.filter((event) => !event.allDay && event.start > now);
}
