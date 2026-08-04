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
