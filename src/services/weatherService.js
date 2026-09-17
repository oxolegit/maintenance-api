import { UpstreamError } from "../errors/index.js";
import { TimeoutError } from "../clients/errors.js";

export function evaluateDay(day, rule) {
  const reasons = [];
  if (day.precipitation > rule.maxPrecipitationMm) {
    reasons.push(`осадки ${day.precipitation} мм выше порога ${rule.maxPrecipitationMm} мм`);
  }
  if (day.windSpeedMax > rule.maxWindSpeedMs) {
    reasons.push(`ветер ${day.windSpeedMax} м/с выше порога ${rule.maxWindSpeedMs} м/с`);
  }
  return { ...day, suitable: reasons.length === 0, reasons };
}

export function createWeatherService({ weatherClient, config, logger }) {
  const { forecastDays, maxWindSpeedMs, maxPrecipitationMm, cacheTtlMs } = config;
  const rule = { maxWindSpeedMs, maxPrecipitationMm };
  const cache = new Map();

  async function fetchDays(location, days) {
    const key = `${location.lat},${location.lon},${days}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.days;
    }

    let daysForecast;
    try {
      daysForecast = await weatherClient.getDailyForecast(location, days);
    } catch (error) {
      logger.warn({ err: error, location }, "погодный сервис недоступен");
      const timeout = error instanceof TimeoutError;
      throw new UpstreamError(
        timeout
          ? "Погодный сервис не ответил за отведённое время, попробуйте позже"
          : "Погодный сервис недоступен, попробуйте позже",
        { timeout },
      );
    }

    cache.set(key, { days: daysForecast, expiresAt: Date.now() + cacheTtlMs });
    return daysForecast;
  }

  return {
    rule,

    async getForecast(location, days = forecastDays) {
      const evaluated = (await fetchDays(location, days)).map((day) => evaluateDay(day, rule));
      const firstSuitable = evaluated.find((day) => day.suitable);

      return {
        location,
        generatedAt: new Date().toISOString(),
        rule,
        days: evaluated,
        hasSuitableWindow: Boolean(firstSuitable),
        nextSuitableDate: firstSuitable ? firstSuitable.date : null,
      };
    },
  };
}
