import { fetchJson } from "./http.js";
import { InvalidJsonError } from "./errors.js";

const DAILY_FIELDS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
];

function normalizeDaily(daily, url) {
  if (!daily || !Array.isArray(daily.time)) {
    throw new InvalidJsonError(url);
  }
  return daily.time.map((date, i) => ({
    date,
    tempMin: daily.temperature_2m_min[i],
    tempMax: daily.temperature_2m_max[i],
    precipitation: daily.precipitation_sum[i],
    windSpeedMax: daily.wind_speed_10m_max[i],
    windGustsMax: daily.wind_gusts_10m_max[i],
  }));
}

export function createOpenMeteoClient({ apiUrl, timeoutMs }) {
  return {
    async getDailyForecast({ lat, lon }, days) {
      const url = new URL(apiUrl);
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lon));
      url.searchParams.set("daily", DAILY_FIELDS.join(","));
      url.searchParams.set("wind_speed_unit", "ms");
      url.searchParams.set("forecast_days", String(days));
      url.searchParams.set("timezone", "auto");

      const data = await fetchJson(url, timeoutMs);
      return normalizeDaily(data.daily, url.toString());
    },
  };
}
