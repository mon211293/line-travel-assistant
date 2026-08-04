import { Firestore } from "@google-cloud/firestore";

const COLLECTION = "weather-sent-days";
const firestore = new Firestore();

/** 檢查今天(dateKey, YYYY-MM-DD)是否已經推播過天氣(避免每 15 分鐘檢查一次時重複發送)。 */
export async function hasSentWeatherToday(dateKey: string): Promise<boolean> {
  const doc = await firestore.collection(COLLECTION).doc(dateKey).get();
  return doc.exists;
}

export async function markWeatherSent(dateKey: string): Promise<void> {
  const expireAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await firestore.collection(COLLECTION).doc(dateKey).set({ sentAt: new Date(), expireAt });
}
