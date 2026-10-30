import * as functions from "@google-cloud/functions-framework";
import { messagingApi, validateSignature, type WebhookEvent } from "@line/bot-sdk";
import { loadConfig } from "./config";
import { renderLiffPage } from "./liffPage";
import { handleTripConfigApi } from "./tripConfigApi";
import { setBoundGroupId } from "./targetGroupStore";

const BIND_COMMAND = "綁定群組";

async function handleEvent(event: WebhookEvent, accessToken: string): Promise<void> {
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: accessToken });

  // 回覆訊息(replyToken)免費、不算推播額度,所以這裡一律用 reply,不用 push。
  if (event.type === "join") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `我加入囉!管理者在這個群組輸入「${BIND_COMMAND}」,之後的行程推播就會發到這裡。` }],
    });
    return;
  }

  if (event.type !== "message" || event.message.type !== "text") return;
  if (event.message.text.trim() !== BIND_COMMAND) return;

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
// 2. LINE webhook(POST /):目前只處理「綁定群組」指令與加入群組事件。
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
        await handleEvent(event, config.line.channelAccessToken);
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
