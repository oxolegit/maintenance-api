import request from "supertest";
import { buildApp, equipmentPayload, withKey } from "./helpers/app.js";

describe("CORS", () => {
  test("отдаёт заголовки только для разрешённого источника", async () => {
    const { app } = await buildApp({
      env: { CORS_ORIGINS: "http://app.local, http://admin.local" },
    });

    const allowed = await request(app).get("/api/health").set("Origin", "http://admin.local");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://admin.local");
    expect(allowed.headers["access-control-expose-headers"]).toContain("Location");

    const denied = await request(app).get("/api/health").set("Origin", "http://evil.local");
    expect(denied.status).toBe(200);
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("отвечает на preflight с разрешёнными методами и заголовками", async () => {
    const { app } = await buildApp({ env: { CORS_ORIGINS: "http://app.local" } });

    const res = await request(app)
      .options("/api/requests")
      .set("Origin", "http://app.local")
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "content-type,x-api-key");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,PATCH,DELETE");
    expect(res.headers["access-control-allow-headers"]).toContain("X-API-Key");
  });
});

describe("защитные заголовки", () => {
  test("helmet выставляет заголовки, X-Powered-By отсутствует", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/api/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("ограничение частоты запросов", () => {
  test("возвращает 429 с заголовками лимита после превышения", async () => {
    const { app } = await buildApp({ env: { RATE_LIMIT_MAX: "2", RATE_LIMIT_WINDOW_MS: "60000" } });

    const first = await request(app).get("/api/health");
    expect(first.status).toBe(200);
    expect(first.headers["ratelimit-policy"]).toBe("2;w=60");
    expect(first.headers["ratelimit"]).toContain("remaining=1");

    await request(app).get("/api/health");
    const limited = await request(app).get("/api/health");

    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(limited.headers["ratelimit"]).toContain("remaining=0");
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("API-ключ", () => {
  test("изменяющие операции без ключа отклоняются с 401", async () => {
    const { app } = await buildApp();
    const res = await request(app).post("/api/equipment").send(equipmentPayload());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("неверный ключ отклоняется, верный — принимается, чтение открыто", async () => {
    const { app } = await buildApp();

    const wrong = await request(app)
      .post("/api/equipment")
      .set("X-API-Key", "wrong")
      .send(equipmentPayload());
    expect(wrong.status).toBe(401);

    const right = await withKey(request(app).post("/api/equipment")).send(equipmentPayload());
    expect(right.status).toBe(201);

    const list = await request(app).get("/api/equipment");
    expect(list.status).toBe(200);
  });

  test("при пустом API_KEY проверка отключена", async () => {
    const { app } = await buildApp({ env: { API_KEY: "" } });
    const res = await request(app).post("/api/equipment").send(equipmentPayload());

    expect(res.status).toBe(201);
  });
});
