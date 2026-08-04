import * as functions from "@google-cloud/functions-framework";
import { validateSignature, type WebhookRequestBody } from "@line/bot-sdk";
import { loadConfig } from "./config";
import { handleEvent } from "./router";
import { renderLiffPage } from "./liffPage";
import { handleTripConfigApi } from "./tripConfigApi";

async function handleLineWebhook(req: functions.Request, res: functions.Response): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const config = await loadConfig();

  const signature = req.headers["x-line-signature"];
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (typeof signature !== "string" || !rawBody || !validateSignature(rawBody, config.line.channelSecret, signature)) {
    res.status(401).send("Invalid signature");
    return;
  }

  const body = req.body as WebhookRequestBody;

  await Promise.all(
    body.events.map((event) =>
      handleEvent(config, event).catch((err) => {
        console.error("處理事件失敗", event, err);
      })
    )
  );

  res.status(200).send("OK");
}

// 同一個 Cloud Function 依路徑分流:LINE 平台呼叫的 webhook(POST /)、
// 「行程設定」LIFF 網頁(GET /liff),以及該網頁呼叫的 API(/api/config)。
functions.http("travelWebhook", async (req, res) => {
  if (req.path === "/liff") {
    res.status(200).set("Content-Type", "text/html; charset=utf-8").send(renderLiffPage());
    return;
  }

  if (req.path === "/api/config") {
    await handleTripConfigApi(req, res);
    return;
  }

  await handleLineWebhook(req, res);
});
