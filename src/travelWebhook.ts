import * as functions from "@google-cloud/functions-framework";
import { renderLiffPage } from "./liffPage";
import { handleTripConfigApi } from "./tripConfigApi";

// 設定入口是 Rich Menu 直接連到 LIFF 連結(uri action),不經過聊天訊息,
// 所以這個 Cloud Function 不用處理 LINE webhook 事件,只服務:
// 「行程設定」LIFF 網頁(GET /liff),以及該網頁呼叫的 API(/api/config)。
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

  res.status(404).send("Not Found");
});
