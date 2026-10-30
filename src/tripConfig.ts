import { Firestore } from "@google-cloud/firestore";
import { DEFAULT_TIME_ZONE } from "./timeZoneUtil";

const COLLECTION = "trip-config";
// 這個機器人只服務單一旅遊群組(見 config.ts 的 TRAVEL_TARGET_GROUP_ID),
// 所以行程設定用單一固定文件就夠,不用像多租戶那樣依群組/使用者分文件。
const DOC_ID = "current";

const firestore = new Firestore();

const DEFAULT_DAILY_TIME = "07:00";

export interface CityRef {
  country: string;
  city: string;
}

export interface ScheduledMessage {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm,依 config.timezone 判斷
  text: string;
}

/** 有人在群組輸入 keyword,機器人就回覆 text(免費的回覆訊息,不算推播額度)。
 * 同一個 keyword 可以設多筆搭配 fromDate 切換內容:今天 >= fromDate 的那幾筆裡取 fromDate 最晚的一筆;
 * fromDate 留空代表「一開始就用」。例如「班機」先設去程(不填日期)、再設回程(fromDate 填出發日隔天)。 */
export interface AutoReply {
  id: string;
  keyword: string;
  fromDate?: string; // YYYY-MM-DD,依 config.timezone 判斷「今天」
  text: string;
}

export interface TripConfig {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  /** 整個行程共用同一個時區,用來判斷「今天」跟所有時間比對的基準。不設定時預設 Asia/Tokyo(向下相容舊資料)。 */
  timezone?: string;
  /** 每日「行程總覽+天氣」推播時間(欄位沿用舊名 weatherTime),HH:mm,不設定時預設 07:00 */
  weatherTime?: string;
  /** 每天到訪的城市,key 是 YYYY-MM-DD。某天沒設定就當天不推播天氣(例如還在移動、還沒決定)。 */
  cityByDate: Record<string, CityRef>;
  /** 使用者自訂的預約訊息,每則只在指定的日期+時間發送一次。沒有設定就完全不會多發任何東西。 */
  scheduledMessages: ScheduledMessage[];
  /** 舊資料沒有這個欄位,讀取時要當作空陣列。 */
  autoReplies?: AutoReply[];
}

export function getTimeZone(config: TripConfig | null): string {
  return config?.timezone ?? DEFAULT_TIME_ZONE;
}

export async function getTripConfig(): Promise<TripConfig | null> {
  const doc = await firestore.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return null;
  return doc.data() as TripConfig;
}

export async function setTripConfig(config: TripConfig): Promise<void> {
  await firestore.collection(COLLECTION).doc(DOC_ID).set(config);
}

/** 判斷 dateKey(YYYY-MM-DD)是否落在行程日期範圍內(含頭尾)。沒設定行程時視為不在範圍內。 */
export function isWithinTrip(config: TripConfig | null, dateKey: string): boolean {
  if (!config) return false;
  return dateKey >= config.startDate && dateKey <= config.endDate;
}

/** 判斷現在(timeOfDay,格式 HH:mm)是否已經到了每日推播的時間點。
 * 用「>=」而非精確比對,搭配每 15 分鐘一次的排程觸發,不會因為觸發時間跟設定時間沒對齊而永遠不觸發。 */
export function isPastDailyTime(config: TripConfig, timeOfDay: string): boolean {
  return timeOfDay >= (config.weatherTime ?? DEFAULT_DAILY_TIME);
}

/** 依今天日期挑出某個關鍵字該回覆的內容;沒有符合的就回傳 null(機器人不回)。 */
export function pickAutoReply(replies: AutoReply[], keyword: string, dateKey: string): string | null {
  const eligible = replies.filter((r) => r.keyword === keyword && (!r.fromDate || r.fromDate <= dateKey));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => (a.fromDate ?? "").localeCompare(b.fromDate ?? ""));
  return eligible[eligible.length - 1].text;
}
