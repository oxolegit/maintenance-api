import request from "supertest";
import { buildApp, equipmentPayload, withKey } from "./helpers/app.js";

describe("обработка ошибок", () => {
  test("несуществующий маршрут возвращает 404 в едином формате", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/api/unknown");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: expect.stringContaining("/api/unknown"),
        requestId: expect.any(String),
      },
    });
    expect(res.headers["x-request-id"]).toBe(res.body.error.requestId);
  });

  test("некорректный JSON в теле возвращает 400", async () => {
    const { app } = await buildApp();
    const res = await withKey(request(app).post("/api/equipment"))
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  test("тело больше лимита возвращает 413", async () => {
    const { app } = await buildApp({ env: { JSON_BODY_LIMIT: "1kb" } });
    const res = await withKey(request(app).post("/api/equipment")).send(
      equipmentPayload({ name: "x".repeat(2000) }),
    );

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  test("переданный X-Request-Id сохраняется и возвращается в ответе", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/api/unknown").set("X-Request-Id", "trace-42");

    expect(res.headers["x-request-id"]).toBe("trace-42");
    expect(res.body.error.requestId).toBe("trace-42");
  });

  test("необработанная ошибка контроллера превращается в 500 с деталями вне production", async () => {
    const { app, repositories } = await buildApp();
    repositories.equipmentRepository.findById = async () => {
      throw new Error("хранилище недоступно");
    };

    const res = await request(app).get("/api/equipment/0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.error.message).toBe("хранилище недоступно");
    expect(res.body.error.stack).toBeDefined();
  });

  test("в production внутренние детали и стек скрыты", async () => {
    const { app, repositories } = await buildApp({ env: { NODE_ENV: "production" } });
    repositories.equipmentRepository.findById = async () => {
      throw new Error("хранилище недоступно");
    };

    const res = await request(app).get("/api/equipment/0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11");

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера",
      requestId: expect.any(String),
    });
  });
});
