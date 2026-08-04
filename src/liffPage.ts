import { CITIES } from "./cities";
import { TIME_ZONE_OPTIONS, DEFAULT_TIME_ZONE } from "./timeZoneUtil";

/** 產生「行程設定」LIFF 頁面。用 LIFF ID Token 驗證,只有 OWNER_USER_ID 那個 LINE 帳號能看/能改——
 * 這個 Rich Menu 連結是這個官方帳號所有好友都看得到的同一個選單,所以一定要擋非擁有者,
 * 不然任何人加這個 OA 為好友就能看到、甚至改掉整個旅遊行程設定。 */
export function renderLiffPage(liffId: string): string {
  const citiesJson = JSON.stringify(CITIES);
  const liffIdJson = JSON.stringify(liffId);
  const timeZoneOptionsJson = JSON.stringify(TIME_ZONE_OPTIONS);
  const defaultTimeZoneJson = JSON.stringify(DEFAULT_TIME_ZONE);

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>旅遊行程設定</title>
<style>
  body { font-family: -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif; padding: 20px; max-width: 480px; margin: 0 auto; color: #222; }
  h1 { font-size: 20px; }
  h2 { font-size: 15px; margin-top: 24px; }
  label { display: block; margin-top: 16px; font-weight: bold; font-size: 14px; }
  select, input { width: 100%; box-sizing: border-box; padding: 10px; margin-top: 6px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; }
  button { width: 100%; margin-top: 24px; padding: 14px; border: none; border-radius: 8px; background: #06c755; color: white; font-size: 16px; font-weight: bold; }
  #status { margin-top: 16px; font-size: 14px; text-align: center; }
  .day-row { margin-top: 12px; padding: 10px; border: 1px solid #eee; border-radius: 8px; background: #fafafa; }
  .day-row .day-label { font-weight: bold; font-size: 14px; }
  .day-row select { margin-top: 8px; }
  textarea { width: 100%; box-sizing: border-box; padding: 10px; margin-top: 6px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; font-family: inherit; resize: vertical; }
  .msg-row { margin-top: 10px; padding: 10px; border: 1px solid #eee; border-radius: 8px; background: #fafafa; }
  .msg-row .msg-meta { font-size: 13px; color: #666; font-weight: bold; }
  .msg-row .msg-text { margin-top: 4px; font-size: 14px; white-space: pre-wrap; }
  .msg-row .msg-delete { width: auto; margin-top: 8px; padding: 6px 12px; background: #e05555; font-size: 13px; }
  .msg-add-row { margin-top: 16px; padding: 12px; border: 1px dashed #ccc; border-radius: 8px; }
  .msg-add-row .msg-add-btn { background: #2563a6; }
</style>
</head>
<body>
  <h1>🧳 旅遊行程設定</h1>
  <div id="authMessage" style="display:none;color:#e05555;font-weight:bold;padding:12px;background:#fff0f0;border-radius:8px;"></div>

  <div id="formContent" style="display:none;">
  <p style="font-size:13px;color:#666;">設定旅遊日期後,可以幫每一天分別選要去的城市,機器人只會在這段期間每天推播行程,並在你設定的時間送上當天城市的天氣。</p>

  <label for="timezone">行程時區</label>
  <select id="timezone"></select>
  <p style="font-size:12px;color:#999;margin:4px 0 0;">下面所有時間(天氣推播時間、預約訊息時間)都是用這個時區判斷。</p>

  <label for="startDate">開始日期</label>
  <input type="date" id="startDate" />

  <label for="endDate">結束日期</label>
  <input type="date" id="endDate" />

  <label for="weatherTime">天氣推播時間</label>
  <input type="time" id="weatherTime" />

  <h2>📍 每天到訪城市</h2>
  <div id="dayCities"></div>

  <h2>📨 預約訊息</h2>
  <p style="font-size:13px;color:#666;margin:4px 0 0;">指定日期+時間發送自訂訊息,每則只發一次。沒有設定就不會多發任何東西。</p>
  <div id="messageList"></div>

  <div class="msg-add-row">
    <label for="newMsgDate">日期</label>
    <input type="date" id="newMsgDate" />
    <label for="newMsgTime">時間</label>
    <input type="time" id="newMsgTime" />
    <label for="newMsgText">訊息內容</label>
    <textarea id="newMsgText" rows="3" placeholder="例如:記得去藥妝店買防曬"></textarea>
    <button id="addMessage" class="msg-add-btn" type="button">＋ 新增預約訊息</button>
  </div>

  <button id="save">儲存</button>
  <div id="status"></div>
  </div>

<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
<script>
  const CITIES = ${citiesJson};
  const LIFF_ID = ${liffIdJson};
  const TIME_ZONE_OPTIONS = ${timeZoneOptionsJson};
  const DEFAULT_TIME_ZONE = ${defaultTimeZoneJson};
  const COUNTRIES = [...new Set(CITIES.map((c) => c.country))];
  let idToken = null;

  function authHeaders() {
    return idToken ? { Authorization: "Bearer " + idToken } : {};
  }

  function showAuthError(message) {
    document.getElementById("authMessage").textContent = message;
    document.getElementById("authMessage").style.display = "block";
    document.getElementById("formContent").style.display = "none";
  }

  const timezoneEl = document.getElementById("timezone");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const weatherTimeEl = document.getElementById("weatherTime");
  const dayCitiesEl = document.getElementById("dayCities");
  const statusEl = document.getElementById("status");
  weatherTimeEl.value = "07:00";

  for (const tz of TIME_ZONE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = tz.value;
    opt.textContent = tz.label;
    timezoneEl.appendChild(opt);
  }
  timezoneEl.value = DEFAULT_TIME_ZONE;

  let cityByDate = {}; // dateKey -> { country, city }
  let scheduledMessages = []; // [{ id, date, time, text }]

  function makeMessageId() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "msg-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  function renderMessageList() {
    const listEl = document.getElementById("messageList");
    listEl.innerHTML = "";

    if (scheduledMessages.length === 0) {
      listEl.innerHTML = "<p style='color:#999;font-size:13px;'>目前沒有預約訊息</p>";
      return;
    }

    const sorted = [...scheduledMessages].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    for (const msg of sorted) {
      const row = document.createElement("div");
      row.className = "msg-row";

      const meta = document.createElement("div");
      meta.className = "msg-meta";
      meta.textContent = formatDayLabel(msg.date) + " " + msg.time;
      row.appendChild(meta);

      const text = document.createElement("div");
      text.className = "msg-text";
      text.textContent = msg.text;
      row.appendChild(text);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "msg-delete";
      deleteBtn.type = "button";
      deleteBtn.textContent = "刪除";
      deleteBtn.addEventListener("click", () => {
        scheduledMessages = scheduledMessages.filter((m) => m.id !== msg.id);
        renderMessageList();
      });
      row.appendChild(deleteBtn);

      listEl.appendChild(row);
    }
  }

  // 全部用 UTC 存取 Date 物件,把 dateKey 當成「純日期」(不代表任何真實時刻)來處理,
  // 避免瀏覽器本地時區(例如使用者在日本/台灣是 UTC+8/+9)造成 toISOString() 換算時日期跑掉一天。
  function listDatesInRange(start, end) {
    const dates = [];
    let cursor = new Date(start + "T00:00:00Z");
    const endDate = new Date(end + "T00:00:00Z");
    while (cursor <= endDate) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return dates;
  }

  function formatDayLabel(dateKey) {
    const d = new Date(dateKey + "T00:00:00Z");
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getUTCDay()];
    return (d.getUTCMonth() + 1) + "/" + d.getUTCDate() + " (" + weekday + ")";
  }

  function citiesFor(country) {
    return CITIES.filter((c) => c.country === country);
  }

  function renderDayRows() {
    if (!startDateEl.value || !endDateEl.value || startDateEl.value > endDateEl.value) {
      dayCitiesEl.innerHTML = "<p style='color:#999;font-size:13px;'>請先選好開始/結束日期</p>";
      return;
    }

    const dates = listDatesInRange(startDateEl.value, endDateEl.value);
    dayCitiesEl.innerHTML = "";

    for (const dateKey of dates) {
      const existing = cityByDate[dateKey];
      const row = document.createElement("div");
      row.className = "day-row";
      row.dataset.date = dateKey;

      const label = document.createElement("div");
      label.className = "day-label";
      label.textContent = formatDayLabel(dateKey);
      row.appendChild(label);

      const countrySelect = document.createElement("select");
      countrySelect.className = "day-country";
      for (const country of COUNTRIES) {
        const opt = document.createElement("option");
        opt.value = country;
        opt.textContent = CITIES.find((c) => c.country === country).countryLabel;
        countrySelect.appendChild(opt);
      }
      row.appendChild(countrySelect);

      const citySelect = document.createElement("select");
      citySelect.className = "day-city";
      row.appendChild(citySelect);

      function fillCitySelect(country, selectedCity) {
        citySelect.innerHTML = "";
        for (const c of citiesFor(country)) {
          const opt = document.createElement("option");
          opt.value = c.city;
          opt.textContent = c.cityLabel;
          if (c.city === selectedCity) opt.selected = true;
          citySelect.appendChild(opt);
        }
      }

      countrySelect.value = existing ? existing.country : COUNTRIES[0];
      fillCitySelect(countrySelect.value, existing ? existing.city : undefined);
      countrySelect.addEventListener("change", () => fillCitySelect(countrySelect.value));

      dayCitiesEl.appendChild(row);
    }
  }

  startDateEl.addEventListener("change", renderDayRows);
  endDateEl.addEventListener("change", renderDayRows);

  document.getElementById("addMessage").addEventListener("click", () => {
    const dateEl = document.getElementById("newMsgDate");
    const timeEl = document.getElementById("newMsgTime");
    const textEl = document.getElementById("newMsgText");

    if (!dateEl.value || !timeEl.value || !textEl.value.trim()) {
      statusEl.textContent = "請填完日期、時間、訊息內容再新增";
      return;
    }

    scheduledMessages.push({ id: makeMessageId(), date: dateEl.value, time: timeEl.value, text: textEl.value.trim() });
    dateEl.value = "";
    timeEl.value = "";
    textEl.value = "";
    statusEl.textContent = "";
    renderMessageList();
  });

  async function loadConfig() {
    const res = await fetch("api/config", { headers: authHeaders() });
    if (res.status === 403 || res.status === 401) {
      showAuthError("🚫 你沒有權限使用這個設定頁面");
      return;
    }

    try {
      const data = await res.json();
      if (data.config) {
        timezoneEl.value = data.config.timezone || DEFAULT_TIME_ZONE;
        startDateEl.value = data.config.startDate;
        endDateEl.value = data.config.endDate;
        weatherTimeEl.value = data.config.weatherTime || "07:00";
        cityByDate = data.config.cityByDate || {};
        scheduledMessages = data.config.scheduledMessages || [];
      }
    } catch (err) {
      // 沒有既有設定就當作全新開始
    }
    document.getElementById("formContent").style.display = "block";
    renderDayRows();
    renderMessageList();
  }

  document.getElementById("save").addEventListener("click", async () => {
    if (!startDateEl.value || !endDateEl.value) {
      statusEl.textContent = "請選擇日期";
      return;
    }
    if (startDateEl.value > endDateEl.value) {
      statusEl.textContent = "開始日期不能比結束日期晚";
      return;
    }

    const newCityByDate = {};
    for (const row of dayCitiesEl.querySelectorAll(".day-row")) {
      const country = row.querySelector(".day-country").value;
      const city = row.querySelector(".day-city").value;
      newCityByDate[row.dataset.date] = { country, city };
    }

    statusEl.textContent = "儲存中...";
    try {
      const res = await fetch("api/config", {
        method: "PUT",
        headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
        body: JSON.stringify({
          timezone: timezoneEl.value,
          startDate: startDateEl.value,
          endDate: endDateEl.value,
          weatherTime: weatherTimeEl.value || "07:00",
          cityByDate: newCityByDate,
          scheduledMessages,
        }),
      });
      if (!res.ok) throw new Error("儲存失敗");
      statusEl.textContent = "✅ 已儲存";
    } catch (err) {
      statusEl.textContent = "❌ 儲存失敗,請稍後再試";
    }
  });

  async function initAuthAndLoad() {
    try {
      await liff.init({ liffId: LIFF_ID });
    } catch (err) {
      showAuthError("❌ LIFF 初始化失敗,請確認是從 LINE 裡開啟這個連結");
      return;
    }

    if (!liff.isLoggedIn()) {
      liff.login();
      return; // 會導去登入,登入完成後 LINE 會重新載入這個頁面
    }

    idToken = liff.getIDToken();
    if (!idToken) {
      showAuthError("❌ 無法取得身份驗證,請確認 LIFF App 有開啟 openid scope");
      return;
    }

    await loadConfig();
  }

  initAuthAndLoad();
</script>
</body>
</html>`;
}
