export interface City {
  country: string;
  countryLabel: string;
  city: string;
  cityLabel: string;
  lat: number;
  lon: number;
}

// 目前只開放日本/韓國/泰國的常見旅遊城市,之後要加其他國家/城市再擴充這份清單即可
// (不用改其他程式碼,dailyItinerary/webhook 都是動態讀這份清單)。
export const CITIES: City[] = [
  { country: "japan", countryLabel: "日本", city: "tokyo", cityLabel: "東京", lat: 35.6762, lon: 139.6503 },
  { country: "japan", countryLabel: "日本", city: "osaka", cityLabel: "大阪", lat: 34.6937, lon: 135.5023 },
  { country: "japan", countryLabel: "日本", city: "kyoto", cityLabel: "京都", lat: 35.0116, lon: 135.7681 },
  { country: "japan", countryLabel: "日本", city: "sapporo", cityLabel: "札幌", lat: 43.0618, lon: 141.3545 },
  { country: "japan", countryLabel: "日本", city: "fukuoka", cityLabel: "福岡", lat: 33.5904, lon: 130.4017 },
  { country: "japan", countryLabel: "日本", city: "nagoya", cityLabel: "名古屋", lat: 35.1815, lon: 136.9066 },
  { country: "japan", countryLabel: "日本", city: "hiroshima", cityLabel: "廣島", lat: 34.3853, lon: 132.4553 },
  { country: "japan", countryLabel: "日本", city: "okinawa", cityLabel: "沖繩(那霸)", lat: 26.2124, lon: 127.6809 },
  { country: "korea", countryLabel: "韓國", city: "seoul", cityLabel: "首爾", lat: 37.5665, lon: 126.978 },
  { country: "korea", countryLabel: "韓國", city: "busan", cityLabel: "釜山", lat: 35.1796, lon: 129.0756 },
  { country: "korea", countryLabel: "韓國", city: "jeju", cityLabel: "濟州島", lat: 33.4996, lon: 126.5312 },
  { country: "korea", countryLabel: "韓國", city: "incheon", cityLabel: "仁川", lat: 37.4563, lon: 126.7052 },
  { country: "thailand", countryLabel: "泰國", city: "bangkok", cityLabel: "曼谷", lat: 13.7563, lon: 100.5018 },
  { country: "thailand", countryLabel: "泰國", city: "chiangmai", cityLabel: "清邁", lat: 18.7883, lon: 98.9853 },
  { country: "thailand", countryLabel: "泰國", city: "phuket", cityLabel: "普吉島", lat: 7.8804, lon: 98.3923 },
  { country: "thailand", countryLabel: "泰國", city: "pattaya", cityLabel: "芭達雅", lat: 12.9236, lon: 100.8825 },
];

export function findCity(country: string, city: string): City | undefined {
  return CITIES.find((c) => c.country === country && c.city === city);
}
