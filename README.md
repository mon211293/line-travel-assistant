# line-travel-assistant

把 Google 日曆(旅行行程)自動推播到 LINE 旅遊群組。

- 每天 07:00(Asia/Tokyo)推播當天行程
- 每 15 分鐘檢查一次,行程開始前 1 小時內會額外提醒一次(不重複提醒同一場)

## 架構

兩個 Cloud Functions(gen2, Node.js 20, region `asia-east1`, 專案 `bernie-219fb`),由這個 repo 的
GitHub Actions(`.github/workflows/schedule.yml`)定時 curl 觸發,而不是用 Cloud Scheduler
(理由見姊妹專案 line-daily-briefing 的踩坑記錄)。函式本身是 `--allow-unauthenticated`,靠
`x-trigger-secret` header 擋掉非授權呼叫。

## Secret Manager(專案 `bernie-219fb`)

- `TRAVEL_LINE_CHANNEL_ACCESS_TOKEN` / `TRAVEL_LINE_CHANNEL_SECRET` — 這個旅遊助手專用的 LINE 官方帳號
- `TRAVEL_CALENDAR_ID` — 旅行行事曆的日曆 ID(時區 Asia/Tokyo)
- `TRAVEL_TARGET_GROUP_ID` — 推播目標的 LINE 群組 ID
- `TRAVEL_TRIGGER_SECRET` — GitHub Actions 觸發用的共用密碼(同時也要設成這個 repo 的 GitHub Actions secret `TRIGGER_SECRET`)
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REFRESH_TOKEN` — 沿用 line-daily-briefing 專案的 Google OAuth 憑證(同一個 Google 帳號,已確認能存取這個旅行日曆)

換 `TRAVEL_TARGET_GROUP_ID`(例如換一個群組)只要 `gcloud secrets versions add` 就會生效,不用重新部署。

## 部署

```bash
npm run deploy:daily
npm run deploy:reminder
```
