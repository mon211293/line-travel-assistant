import { Firestore } from "@google-cloud/firestore";

const COLLECTION = "trip-config";
// 這個機器人只服務單一旅遊群組(見 config.ts 的 TRAVEL_TARGET_GROUP_ID),
// 所以行程設定用單一固定文件就夠,不用像多租戶那樣依群組/使用者分文件。
const DOC_ID = "current";

const firestore = new Firestore();

export interface TripConfig {
  country: string;
  city: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
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
