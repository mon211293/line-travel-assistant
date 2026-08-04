import { CITIES } from "./cities";

/** 產生「行程設定」LIFF 頁面。純讀寫 /api/config,沒有帳號驗證——
 * 這個頁面只會透過 LINE 群組裡的連結流出,設定的又只是城市/日期(非個資/金流),
 * 為了降低給非技術使用者的操作門檻,刻意不做 LIFF ID Token 驗證(跟 line-assistant 的做法不同)。 */
export function renderLiffPage(): string {
  const citiesJson = JSON.stringify(CITIES);

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
</style>
</head>
<body>
  <h1>🧳 旅遊行程設定</h1>
  <p style="font-size:13px;color:#666;">設定旅遊日期後,可以幫每一天分別選要去的城市,機器人只會在這段期間每天推播行程,並在你設定的時間送上當天城市的天氣。</p>

  <label for="startDate">開始日期</label>
  <input type="date" id="startDate" />

  <label for="endDate">結束日期</label>
  <input type="date" id="endDate" />

  <label for="weatherTime">天氣推播時間(日本時間)</label>
  <input type="time" id="weatherTime" />

  <h2>📍 每天到訪城市</h2>
  <div id="dayCities"></div>

  <button id="save">儲存</button>
  <div id="status"></div>

<script>
  const CITIES = ${citiesJson};
  const COUNTRIES = [...new Set(CITIES.map((c) => c.country))];

  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const weatherTimeEl = document.getElementById("weatherTime");
  const dayCitiesEl = document.getElementById("dayCities");
  const statusEl = document.getElementById("status");
  weatherTimeEl.value = "07:00";

  let cityByDate = {}; // dateKey -> { country, city }

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

  async function loadConfig() {
    try {
      const res = await fetch("api/config");
      const data = await res.json();
      if (data.config) {
        startDateEl.value = data.config.startDate;
        endDateEl.value = data.config.endDate;
        weatherTimeEl.value = data.config.weatherTime || "07:00";
        cityByDate = data.config.cityByDate || {};
      }
    } catch (err) {
      // 沒有既有設定就當作全新開始
    }
    renderDayRows();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDateEl.value,
          endDate: endDateEl.value,
          weatherTime: weatherTimeEl.value || "07:00",
          cityByDate: newCityByDate,
        }),
      });
      if (!res.ok) throw new Error("儲存失敗");
      statusEl.textContent = "✅ 已儲存";
    } catch (err) {
      statusEl.textContent = "❌ 儲存失敗,請稍後再試";
    }
  });

  loadConfig();
</script>
</body>
</html>`;
}
