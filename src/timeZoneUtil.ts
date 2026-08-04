export interface TimeZoneOption {
  value: string; // IANA timezone name
  label: string;
}

// 目前行程只會用到這幾個時區(日本/韓國同為 UTC+9,分開列是為了讓使用者選起來對應行程國家比較直覺)。
export const TIME_ZONE_OPTIONS: TimeZoneOption[] = [
  { value: "Asia/Tokyo", label: "日本(UTC+9)" },
  { value: "Asia/Seoul", label: "韓國(UTC+9)" },
  { value: "Asia/Bangkok", label: "泰國(UTC+7)" },
  { value: "Asia/Taipei", label: "台灣(UTC+8)" },
];

export const DEFAULT_TIME_ZONE = "Asia/Tokyo";

export function isKnownTimeZone(value: string): boolean {
  return TIME_ZONE_OPTIONS.some((tz) => tz.value === value);
}

/** 算出某個時間點在指定時區的 UTC 位移字串(例如 "+09:00"),用來把「這個時區的某天 00:00/23:59:59」
 * 轉成正確的 UTC 時刻,而不是寫死某個固定時區的位移。 */
export function getUtcOffsetString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(date);
  const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = offset.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "+00:00";
}

export function getDateKey(day: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(day);
}

export function getTimeOfDay(day: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(day);
}
