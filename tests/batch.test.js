import request from "supertest";
import { buildApp, equipmentPayload, requestPayload, withKey } from "./helpers/app.js";

let app;
let equipment;

beforeEach(async () => {
  ({ app } = await buildApp());
  const res = await withKey(request(app).post("/api/equipment")).send(equipmentPayload());
  equipment = res.body.data;
});

describe("POST /api/requests/batch", () => {
  test("возвращает 207 и отчёт по каждой записи", async () => {
    const res = await withKey(request(app).post("/api/requests/batch")).send({
      items: [
        requestPayload(equipment.id),
        requestPayload("0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11"),
        requestPayload(equipment.id, { title: "Кор" }),
        "не объект",
      ],
    });

    expect(res.status).toBe(207);
    expect(res.body.data.summary).toEqual({ total: 4, created: 1, failed: 3 });
    expect(res.body.data.results.map((result) => result.status)).toEqual([201, 404, 422, 422]);
    expect(res.body.data.results[0].data.status).toBe("new");
    expect(res.body.data.results[1].error.code).toBe("EQUIPMENT_NOT_FOUND");
    expect(res.body.data.results[2].error.details[0].field).toBe("title");

    const list = await request(app).get("/api/requests");
    expect(list.body.meta.total).toBe(1);
  });

  test("возвращает 422 при пустом или отсутствующем массиве items", async () => {
    const empty = await withKey(request(app).post("/api/requests/batch")).send({ items: [] });
    expect(empty.status).toBe(422);

    const missing = await withKey(request(app).post("/api/requests/batch")).send({});
    expect(missing.status).toBe(422);
    expect(missing.body.error.details[0].field).toBe("items");
  });

  test("требует API-ключ", async () => {
    const res = await request(app)
      .post("/api/requests/batch")
      .send({ items: [requestPayload(equipment.id)] });

    expect(res.status).toBe(401);
  });
});
