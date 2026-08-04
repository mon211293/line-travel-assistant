import { messagingApi } from "@line/bot-sdk";
import type { AppConfig } from "./config";

function buildClient(config: AppConfig) {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });
}

/** 推播文字訊息到旅遊群組。 */
export async function pushText(config: AppConfig, text: string): Promise<void> {
  const client = buildClient(config);

  await client.pushMessage({
    to: config.line.targetGroupId,
    messages: [{ type: "text", text }],
  });
}

/** 回覆使用者這次傳來的訊息(用 webhook 事件附的 replyToken,免費且即時)。 */
export async function replyText(config: AppConfig, replyToken: string, text: string): Promise<void> {
  const client = buildClient(config);

  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}
