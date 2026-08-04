import { Firestore } from "@google-cloud/firestore";

const COLLECTION = "scheduled-message-sent";
const firestore = new Firestore();

/** 檢查某則預約訊息(用它自己的 id)是否已經發送過(避免每 15 分鐘檢查一次時重複發送)。 */
export async function hasSentScheduledMessage(messageId: string): Promise<boolean> {
  const doc = await firestore.collection(COLLECTION).doc(messageId).get();
  return doc.exists;
}

export async function markScheduledMessageSent(messageId: string): Promise<void> {
  const expireAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await firestore.collection(COLLECTION).doc(messageId).set({ sentAt: new Date(), expireAt });
}
