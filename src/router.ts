import type { WebhookEvent } from "@line/bot-sdk";
import type { AppConfig } from "./config";
import { replyText } from "./line";

const SETTINGS_COMMANDS = ["設定", "行程設定", "設定行程"];

function buildLiffUrl(): string | null {
  const liffId = process.env.LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}` : null;
}

/** 處理單一 LINE webhook 事件。目前只認「設定/行程設定/設定行程」關鍵字,回覆行程設定頁面連結。 */
export async function handleEvent(config: AppConfig, event: WebhookEvent): Promise<void> {
  if (event.type !== "message" || event.message.type !== "text") return;
  const text = event.message.text.trim();

  if (!SETTINGS_COMMANDS.includes(text)) return;

  const liffUrl = buildLiffUrl();
  const reply = liffUrl ? `旅遊行程設定:\n${liffUrl}` : "設定頁面尚未設定完成,請稍後再試。";

  try {
    await replyText(config, event.replyToken, reply);
  } catch (err) {
    console.error("回覆失敗", err);
  }
}
