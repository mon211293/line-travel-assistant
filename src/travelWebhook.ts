import * as functions from "@google-cloud/functions-framework";
import { messagingApi, validateSignature, type WebhookEvent } from "@line/bot-sdk";
import { loadConfig, type AppConfig } from "./config";
import { renderLiffPage } from "./liffPage";
import { handleTripConfigApi } from "./tripConfigApi";
import { setBoundGroupId } from "./targetGroupStore";
import { getTripConfig, getTimeZone, pickAutoReply } from "./tripConfig";
import { getDateKey } from "./timeZoneUtil";
import { buildItinerarySection, buildWeatherSection, formatDateLabel, formatEventLine, mapsUrl } from "./dailyContent";
import { getNextEvents } from "./calendar";
import { parseCommand } from "./commandParser";

const BIND_COMMAND = "綁定群組";

/** 這個官方帳號所有好友都能私訊它,所以只回覆旅遊群組本身,或擁有者的 1 對 1,
 * 避免陌生人加好友後輸入「行程」就看到整個旅遊行程。 */
function isAllowedSource(source: WebhookEvent["source"], targetGroupId: string): boolean {
  if (!source) return false;
  if (source.type === "group") return source.groupId === targetGroupId;
  if (source.type === "user") return source.userId === process.env.OWNER_USER_ID;
  return false;
}

const HELP_TEXT = [
  "📖 可以問我:",
  "・行程 / 明天行程 / 11/20 行程",
  "・下一個行程",
  "・導航(下一個有地點的行程,附地圖連結)",
  "・天氣 / 明天天氣 / 11/20 天氣",
].join("\n");

function dayFromKey(dateKey: string): Date {
  // 用 UTC 正午代表那一天,對 UTC+7~+9 的行程時區來說都還是同一個日期。
  return new Date(`${dateKey}T12:00:00Z`);
}

function dayLabelFor(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "今日";
  return ` ${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))} `;
}

/** 依關鍵字算出要回覆的文字;不是關鍵字就回傳 null(機器人不吭聲,不打擾群組聊天)。
 * 自訂的自動回覆優先於內建指令。 */
async function buildKeywordReply(text: string, config: AppConfig): Promise<string | null> {
  const tripConfig = await getTripConfig();
  const timeZone = getTimeZone(tripConfig);
  const todayKey = getDateKey(new Date(), timeZone);

  const custom = pickAutoReply(tripConfig?.autoReplies ?? [], text, todayKey);
  if (custom) return custom;

  const command = parseCommand(text, todayKey, tripConfig?.startDate);
  if (!command) return null;

  switch (command.type) {
    case "help":
      return HELP_TEXT;

    case "itinerary": {
      const day = dayFromKey(command.dateKey);
      const title = command.dateKey === todayKey ? "今日行程" : "行程";
      const itinerary = await buildItinerarySection(config, timeZone, day, title);
      return itinerary ? `🧳 ${formatDateLabel(day, timeZone)}\n\n${itinerary}` : `${formatDateLabel(day, timeZone)}沒有安排行程 🎉`;
    }

    case "weather": {
      const day = dayFromKey(command.dateKey);
      try {
        const weather = await buildWeatherSection(tripConfig, timeZone, command.dateKey, dayLabelFor(command.dateKey, todayKey));
        return weather ?? `${formatDateLabel(day, timeZone)}還沒有設定所在城市,查不到天氣(可以到「行程設定」選那天的城市)。`;
      } catch (err) {
        console.error("天氣查詢失敗", err);
        return "天氣查詢失敗了(只能查今天起 16 天內的預報),請稍後再試。";
      }
    }

    case "next": {
      const next = (await getNextEvents(config))[0];
      if (!next) return "接下來沒有安排行程 🎉";
      return `⏭ 下一個行程\n${formatDateLabel(next.start, timeZone)}\n${formatEventLine(next, timeZone)}`;
    }

    case "navigate": {
      const next = (await getNextEvents(config)).find((e) => e.location && mapsUrl(e.location));
      if (!next) return "接下來的行程都沒有填地點,沒辦法導航(可以在行事曆的「地點」欄位填上)。";
      return `🧭 導航\n${formatDateLabel(next.start, timeZone)}\n${formatEventLine(next, timeZone)}`;
    }
  }
}

async function handleEvent(event: WebhookEvent, config: AppConfig): Promise<void> {
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.line.channelAccessToken });

  // 回覆訊息(replyToken)免費、不算推播額度,所以這裡一律用 reply,不用 push。
  if (event.type === "join") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `我加入囉!管理者在這個群組輸入「${BIND_COMMAND}」,之後的行程推播就會發到這裡。` }],
    });
    return;
  }

  if (event.type !== "message" || event.message.type !== "text") return;
  const text = event.message.text.trim();

  if (text !== BIND_COMMAND) {
    if (!isAllowedSource(event.source, config.line.targetGroupId)) return;
    const reply = await buildKeywordReply(text, config);
    if (reply) await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: reply }] });
    return;
  }

  // 只有設定頁的擁有者能綁定,避免群組裡其他人把推播目標搶走。
  if (event.source.userId !== process.env.OWNER_USER_ID) return;
  if (event.source.type !== "group") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "請在要接收行程的「群組」裡輸入這個指令。" }],
    });
    return;
  }

  await setBoundGroupId(event.source.groupId);
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "✅ 已綁定這個群組,之後的行程、提醒、天氣都會發到這裡。" }],
  });
}

// 這個 Cloud Function 服務兩件事:
// 1. 「行程設定」LIFF 網頁(GET /liff)與它呼叫的 API(/api/config);
// 2. LINE webhook(POST /):「綁定群組」、加入群組事件,以及關鍵字自動回覆(行程/天氣/自訂)。
//    全部用免費的回覆訊息(replyToken),不消耗每月推播額度。
functions.http("travelWebhook", async (req, res) => {
  if (req.path === "/liff") {
    const liffId = process.env.LIFF_ID ?? "";
    res.status(200).set("Content-Type", "text/html; charset=utf-8").send(renderLiffPage(liffId));
    return;
  }

  if (req.path === "/api/config") {
    await handleTripConfigApi(req, res);
    return;
  }

  if (req.method === "POST" && req.path === "/") {
    try {
      const config = await loadConfig();
      const signature = req.get("x-line-signature") ?? "";
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (!rawBody || !validateSignature(rawBody, config.line.channelSecret, signature)) {
        res.status(401).send("Invalid signature");
        return;
      }

      const events: WebhookEvent[] = req.body?.events ?? [];
      for (const event of events) {
        // 單一事件失敗(例如天氣服務暫時掛掉)不該讓整個 webhook 回 500 觸發 LINE 重送。
        await handleEvent(event, config).catch((err) => console.error("handleEvent failed", err));
      }
      res.status(200).send("OK");
    } catch (err) {
      console.error(err);
      res.status(500).send(err instanceof Error ? err.message : "Unknown error");
    }
    return;
  }

  res.status(404).send("Not Found");
});
