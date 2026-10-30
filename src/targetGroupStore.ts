import { Firestore } from "@google-cloud/firestore";

const COLLECTION = "travel-settings";
const DOC_ID = "target-group";
const firestore = new Firestore();

/** 在群組裡打「綁定群組」記下來的推播目標;沒綁定過就回傳 null,由呼叫端退回 Secret 裡的預設群組。 */
export async function getBoundGroupId(): Promise<string | null> {
  const doc = await firestore.collection(COLLECTION).doc(DOC_ID).get();
  const groupId = doc.exists ? doc.data()?.groupId : undefined;
  return typeof groupId === "string" && groupId ? groupId : null;
}

export async function setBoundGroupId(groupId: string): Promise<void> {
  await firestore.collection(COLLECTION).doc(DOC_ID).set({ groupId, boundAt: new Date() });
}
