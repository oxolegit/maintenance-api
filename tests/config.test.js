import { loadConfig } from "../src/config/index.js";

describe("loadConfig", () => {
  test("подставляет значения по умолчанию и игнорирует пустые строки", () => {
    const config = loadConfig({ PORT: "", LOG_LEVEL: "", DB_PASSWORD: "secret" });

    expect(config.port).toBe(3000);
    expect(config.env).toBe("development");
    expect(config.isProduction).toBe(false);
    expect(config.logLevel).toBe("info");
    expect(config.storage).toEqual({ driver: "file", dataDir: "data" });
    expect(config.db).toEqual({
      host: "localhost",
      port: 5432,
      name: "maintenance",
      user: "maintenance",
      password: "secret",
      pool: { min: 0, max: 10 },
      logSql: false,
      testName: "maintenance_test",
    });
    expect(config.rateLimit).toEqual({ windowMs: 60000, max: 100 });
    expect(config.weather.forecastDays).toBe(3);
    expect(config.apiKey).toBe("");
  });

  test("разбирает список источников CORS", () => {
    const config = loadConfig({
      CORS_ORIGINS: " http://a.local ,http://b.local,, ",
      DB_PASSWORD: "secret",
    });

    expect(config.cors.origins).toEqual(["http://a.local", "http://b.local"]);
  });

  test("бросает ошибку с перечнем некорректных переменных", () => {
    expect(() =>
      loadConfig({ PORT: "abc", NODE_ENV: "staging", WEATHER_FORECAST_DAYS: "12" }),
    ).toThrow(/PORT.*NODE_ENV.*WEATHER_FORECAST_DAYS/s);
  });

  test("требует пароль БД", () => {
    expect(() => loadConfig({ DB_PASSWORD: "" })).toThrow(/DB_PASSWORD/);
  });
});
