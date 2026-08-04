import * as functions from "@google-cloud/functions-framework";
import { loadConfig, type AppConfig } from "./config";
import { pushText } from "./line";
import { isAuthorizedTrigger } from "./httpAuth";
import { getTripConfig, getTimeZone } from "./tripConfig";
import { hasSentScheduledMessage, markScheduledMessageSent } from "./scheduledMessageSentStore";
import { getDateKey, getTimeOfDay } from "./timeZoneUtil";

// 每 15 分鐘由排程觸發一次。沒有設定任何預約訊息就什麼都不做——
// 這是使用者明確要求的行為(不想因為這個功能平白多收到訊息)。
export async function scheduledMessagePush(config: AppConfig): Promise<void> {
  const tripConfig = await getTripConfig();
  const messages = tripConfig?.scheduledMessages ?? [];
  if (messages.length === 0) return;

  const timeZone = getTimeZone(tripConfig);
  const now = new Date();
  const dateKey = getDateKey(now, timeZone);
  const timeOfDay = getTimeOfDay(now, timeZone);

  const due = messages.filter((m) => m.date === dateKey && timeOfDay >= m.time);

  for (const message of due) {
    if (await hasSentScheduledMessage(message.id)) continue;
    await pushText(config, message.text);
    await markScheduledMessageSent(message.id);
  }
}

functions.http("scheduledMessagePush", async (req, res) => {
  try {
    const config = await loadConfig();
    if (!isAuthorizedTrigger(req, config)) {
      res.status(401).send("Unauthorized");
      return;
    }

    await scheduledMessagePush(config);
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send(err instanceof Error ? err.message : "Unknown error");
  }
});
