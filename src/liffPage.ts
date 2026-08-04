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
  label { display: block; margin-top: 16px; font-weight: bold; font-size: 14px; }
  select, input { width: 100%; box-sizing: border-box; padding: 10px; margin-top: 6px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; }
  button { width: 100%; margin-top: 24px; padding: 14px; border: none; border-radius: 8px; background: #06c755; color: white; font-size: 16px; font-weight: bold; }
  #status { margin-top: 16px; font-size: 14px; text-align: center; }
</style>
</head>
<body>
  <h1>🧳 旅遊行程設定</h1>
  <p style="font-size:13px;color:#666;">設定旅遊地區跟日期,機器人只會在這段期間每天推播行程 + 天氣。</p>

  <label for="country">國家</label>
  <select id="country"></select>

  <label for="city">城市</label>
  <select id="city"></select>

  <label for="startDate">開始日期</label>
  <input type="date" id="startDate" />

  <label for="endDate">結束日期</label>
  <input type="date" id="endDate" />

  <label for="weatherTime">天氣推播時間(日本時間)</label>
  <input type="time" id="weatherTime" />

  <button id="save">儲存</button>
  <div id="status"></div>

<script>
  const CITIES = ${citiesJson};

  const countryEl = document.getElementById("country");
  const cityEl = document.getElementById("city");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const weatherTimeEl = document.getElementById("weatherTime");
  const statusEl = document.getElementById("status");
  weatherTimeEl.value = "07:00";

  const countries = [...new Set(CITIES.map((c) => c.country))];
  for (const country of countries) {
    const label = CITIES.find((c) => c.country === country).countryLabel;
    const opt = document.createElement("option");
    opt.value = country;
    opt.textContent = label;
    countryEl.appendChild(opt);
  }

  function renderCities(country, selectedCity) {
    cityEl.innerHTML = "";
    for (const c of CITIES.filter((c) => c.country === country)) {
      const opt = document.createElement("option");
      opt.value = c.city;
      opt.textContent = c.cityLabel;
      if (c.city === selectedCity) opt.selected = true;
      cityEl.appendChild(opt);
    }
  }

  countryEl.addEventListener("change", () => renderCities(countryEl.value));

  async function loadConfig() {
    try {
      const res = await fetch("api/config");
      const data = await res.json();
      if (data.config) {
        countryEl.value = data.config.country;
        renderCities(data.config.country, data.config.city);
        startDateEl.value = data.config.startDate;
        endDateEl.value = data.config.endDate;
        weatherTimeEl.value = data.config.weatherTime || "07:00";
      } else {
        renderCities(countryEl.value);
      }
    } catch (err) {
      renderCities(countryEl.value);
    }
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

    statusEl.textContent = "儲存中...";
    try {
      const res = await fetch("api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: countryEl.value,
          city: cityEl.value,
          startDate: startDateEl.value,
          endDate: endDateEl.value,
          weatherTime: weatherTimeEl.value || "07:00",
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
