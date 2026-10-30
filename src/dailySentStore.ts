import { Firestore } from "@google-cloud/firestore";

const COLLECTION = "daily-sent-days";
const firestore = new Firestore();

/** 檢查今天(dateKey, YYYY-MM-DD)的「行程總覽+天氣」是否已經推播過(避免每 15 分鐘檢查一次時重複發送)。 */
export async function hasSentDailyToday(dateKey: string): Promise<boolean> {
  const doc = await firestore.collection(COLLECTION).doc(dateKey).get();
  return doc.exists;
}

export async function markDailySent(dateKey: string): Promise<void> {
  const expireAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await firestore.collection(COLLECTION).doc(dateKey).set({ sentAt: new Date(), expireAt });
}
