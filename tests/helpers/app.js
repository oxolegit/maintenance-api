import { loadConfig } from "../../src/config/index.js";
import { createLogger } from "../../src/logger.js";
import { createRepositories } from "../../src/repositories/index.js";
import { createApp } from "../../src/app.js";
import { getTestSequelize } from "./db.js";

export const API_KEY = "test-api-key";

export const equipmentPayload = (overrides = {}) => ({
  name: "Ветротурбина ВТ-01",
  type: "turbine",
  serialNumber: `WT-${Math.random().toString(36).slice(2, 8)}`,
  location: { lat: 55.75, lon: 37.61 },
  installedAt: "2024-05-10",
  ...overrides,
});

export const requestPayload = (equipmentId, overrides = {}) => ({
  equipmentId,
  title: "Замена подшипника главного вала",
  priority: "high",
  ...overrides,
});

export const technicianPayload = (overrides = {}) => ({
  fullName: "Бекиров Руслан Энверович",
  specialization: "механик",
  employeeNumber: `T-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  ...overrides,
});

export const fakeForecastDay = (overrides = {}) => ({
  date: "2026-09-21",
  tempMin: 10,
  tempMax: 18,
  precipitation: 0,
  windSpeedMax: 4.5,
  windGustsMax: 9,
  ...overrides,
});

export async function buildApp({ env = {}, weatherClient, checkDatabase } = {}) {
  const config = loadConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    API_KEY,
    DB_PASSWORD: "test",
    ...env,
  });
  const repositories = createRepositories({ sequelize: getTestSequelize() });
  const app = createApp({
    config,
    repositories,
    logger: createLogger(config),
    weatherClient: weatherClient ?? { getDailyForecast: async () => [fakeForecastDay()] },
    checkDatabase,
  });
  return { app, repositories, config };
}

export const withKey = (req) => req.set("X-API-Key", API_KEY);
