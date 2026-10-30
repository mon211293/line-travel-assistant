import type { City } from "./cities";

// WMO 天氣代碼(Open-Meteo 用這套標準),對照成中文說明。
// 完整表見 https://open-meteo.com/en/docs,這裡只列旅遊常見的幾類。
const WEATHER_CODE_LABEL: Record<number, string> = {
  0: "晴朗",
  1: "晴時多雲",
  2: "多雲",
  3: "陰天",
  45: "有霧",
  48: "霧淞",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "大毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "短暫陣雨",
  81: "陣雨",
  82: "強陣雨",
  95: "雷雨",
  96: "雷雨挾冰雹",
  99: "強雷雨挾冰雹",
};

function describeWeatherCode(code: number): string {
  return WEATHER_CODE_LABEL[code] ?? "天氣狀況不明";
}

export interface DailyWeather {
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number | null;
}

/** 用 Open-Meteo(免費、不用 API key)查指定城市某一天(dateKey,YYYY-MM-DD)的天氣預報。
 * Open-Meteo 只提供未來約 16 天內的預報,超過會回 400。 */
export async function getDayWeather(city: City, timeZone: string, dateKey: string): Promise<DailyWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(city.lat));
  url.searchParams.set("longitude", String(city.lon));
  url.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", timeZone);
  url.searchParams.set("start_date", dateKey);
  url.searchParams.set("end_date", dateKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo 查詢失敗: ${res.status}`);

  const data = (await res.json()) as {
    daily: {
      weathercode: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
    };
  };

  return {
    weatherCode: data.daily.weathercode[0],
    tempMax: data.daily.temperature_2m_max[0],
    tempMin: data.daily.temperature_2m_min[0],
    precipitationProbability: data.daily.precipitation_probability_max?.[0] ?? null,
  };
}

export function formatWeatherText(city: City, weather: DailyWeather, dayLabel = "今日"): string {
  const label = describeWeatherCode(weather.weatherCode);
  const rain = weather.precipitationProbability !== null ? `\n☔ 降雨機率 ${weather.precipitationProbability}%` : "";
  return `🌤️ ${city.cityLabel}${dayLabel}天氣\n${label},${weather.tempMin}°C ~ ${weather.tempMax}°C${rain}`;
}
