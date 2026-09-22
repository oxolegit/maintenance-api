import request from "supertest";
import { buildApp } from "./helpers/app.js";

describe("GET /api/health", () => {
  test("отвечает состоянием процесса и БД", async () => {
    const { app } = await buildApp({ checkDatabase: async () => {} });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "ok", db: "ok" });
    expect(res.body.data).toEqual(
      expect.objectContaining({ uptime: expect.any(Number), timestamp: expect.any(String) }),
    );
  });

  test("при недоступной БД отвечает 503 с пометкой degraded", async () => {
    const { app } = await buildApp({
      checkDatabase: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.data).toMatchObject({ status: "degraded", db: "unavailable" });
  });
});
