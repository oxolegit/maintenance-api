import request from "supertest";
import { buildApp, equipmentPayload, fakeForecastDay, withKey } from "./helpers/app.js";
import { TimeoutError, HttpError } from "../src/clients/errors.js";
import { evaluateDay } from "../src/services/weatherService.js";

async function setup(weatherClient, env) {
  const { app } = await buildApp({ weatherClient, env });
  const res = await withKey(request(app).post("/api/equipment")).send(equipmentPayload());
  return { app, equipmentId: res.body.data.id };
}

describe("GET /api/equipment/:id/weather", () => {
  test("возвращает прогноз с признаком пригодности по каждому дню", async () => {
    const calls = [];
    const weatherClient = {
      async getDailyForecast(location, days) {
        calls.push({ location, days });
        return [
          fakeForecastDay({ date: "2026-09-21", precipitation: 0, windSpeedMax: 4 }),
          fakeForecastDay({ date: "2026-09-22", precipitation: 3.2, windSpeedMax: 4 }),
          fakeForecastDay({ date: "2026-09-23", precipitation: 0, windSpeedMax: 14 }),
        ];
      },
    };
    const { app, equipmentId } = await setup(weatherClient);

    const res = await request(app).get(`/api/equipment/${equipmentId}/weather`);

    expect(res.status).toBe(200);
    expect(calls).toEqual([{ location: { lat: 55.75, lon: 37.61 }, days: 3 }]);
    expect(res.body.data.equipmentId).toBe(equipmentId);
    expect(res.body.data.rule).toEqual({ maxWindSpeedMs: 10, maxPrecipitationMm: 0 });
    expect(res.body.data.days.map((day) => day.suitable)).toEqual([true, false, false]);
    expect(res.body.data.days[1].reasons[0]).toMatch(/осадки/);
    expect(res.body.data.days[2].reasons[0]).toMatch(/ветер/);
    expect(res.body.data.hasSuitableWindow).toBe(true);
    expect(res.body.data.nextSuitableDate).toBe("2026-09-21");
  });

  test("учитывает параметр days и пороги из конфигурации", async () => {
    const calls = [];
    const weatherClient = {
      async getDailyForecast(_location, days) {
        calls.push(days);
        return [fakeForecastDay({ precipitation: 1, windSpeedMax: 12 })];
      },
    };
    const { app, equipmentId } = await setup(weatherClient, {
      WEATHER_MAX_WIND_SPEED_MS: "15",
      WEATHER_MAX_PRECIPITATION_MM: "2",
    });

    const res = await request(app).get(`/api/equipment/${equipmentId}/weather`).query({ days: 5 });

    expect(res.status).toBe(200);
    expect(calls).toEqual([5]);
    expect(res.body.data.days[0].suitable).toBe(true);
  });

  test("кэширует прогноз на время WEATHER_CACHE_TTL_MS", async () => {
    let calls = 0;
    const weatherClient = {
      async getDailyForecast() {
        calls += 1;
        return [fakeForecastDay()];
      },
    };
    const { app, equipmentId } = await setup(weatherClient);

    await request(app).get(`/api/equipment/${equipmentId}/weather`);
    await request(app).get(`/api/equipment/${equipmentId}/weather`);

    expect(calls).toBe(1);
  });

  test("возвращает 400 при days вне диапазона", async () => {
    const { app, equipmentId } = await setup();
    const res = await request(app).get(`/api/equipment/${equipmentId}/weather`).query({ days: 9 });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("days");
  });

  test("возвращает 404 для несуществующего оборудования и не ходит во внешний API", async () => {
    let calls = 0;
    const weatherClient = {
      async getDailyForecast() {
        calls += 1;
        return [];
      },
    };
    const { app } = await setup(weatherClient);

    const res = await request(app).get(
      "/api/equipment/0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11/weather",
    );

    expect(res.status).toBe(404);
    expect(calls).toBe(0);
  });

  test("возвращает 502 при ошибке внешнего API", async () => {
    const weatherClient = {
      async getDailyForecast() {
        throw new HttpError(500, "https://weather.example/forecast");
      },
    };
    const { app, equipmentId } = await setup(weatherClient);

    const res = await request(app).get(`/api/equipment/${equipmentId}/weather`);

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
    expect(res.body.error.requestId).toBeDefined();
  });

  test("возвращает 504 при таймауте внешнего API", async () => {
    const weatherClient = {
      async getDailyForecast() {
        throw new TimeoutError("https://weather.example/forecast");
      },
    };
    const { app, equipmentId } = await setup(weatherClient);

    const res = await request(app).get(`/api/equipment/${equipmentId}/weather`);

    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe("UPSTREAM_TIMEOUT");
  });
});

describe("evaluateDay", () => {
  const rule = { maxWindSpeedMs: 10, maxPrecipitationMm: 0.5 };

  test("день пригоден, если осадки и ветер в пределах порогов", () => {
    const result = evaluateDay(fakeForecastDay({ precipitation: 0.5, windSpeedMax: 10 }), rule);

    expect(result.suitable).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  test("собирает все причины непригодности", () => {
    const result = evaluateDay(fakeForecastDay({ precipitation: 2, windSpeedMax: 11 }), rule);

    expect(result.suitable).toBe(false);
    expect(result.reasons).toHaveLength(2);
  });
});
