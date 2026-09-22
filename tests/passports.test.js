import request from "supertest";
import { buildApp, equipmentPayload, withKey } from "./helpers/app.js";

const passportPayload = (overrides = {}) => ({
  manufacturer: "Vestas",
  model: "V90-2.0",
  ratedPowerKw: 2000,
  lastInspectionAt: "2026-04-15",
  ...overrides,
});

describe("/api/equipment/:id/passport", () => {
  let app;
  let equipment;

  beforeEach(async () => {
    ({ app } = await buildApp());
    equipment = (await withKey(request(app).post("/api/equipment")).send(equipmentPayload())).body
      .data;
  });

  const url = () => `/api/equipment/${equipment.id}/passport`;

  test("PUT создаёт паспорт (201), повторный PUT заменяет его (200), карточка отдаёт паспорт", async () => {
    const created = await withKey(request(app).put(url())).send(passportPayload());
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      equipmentId: equipment.id,
      manufacturer: "Vestas",
      ratedPowerKw: 2000,
      lastInspectionAt: "2026-04-15",
    });

    const replaced = await withKey(request(app).put(url())).send(
      passportPayload({ model: "V90-3.0", ratedPowerKw: 3000.5, lastInspectionAt: null }),
    );
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.id).toBe(created.body.data.id);
    expect(replaced.body.data).toMatchObject({
      model: "V90-3.0",
      ratedPowerKw: 3000.5,
      lastInspectionAt: null,
    });

    const card = await request(app).get(`/api/equipment/${equipment.id}`);
    expect(card.body.data.passport).toEqual(replaced.body.data);
    expect((await request(app).get(url())).body.data).toEqual(replaced.body.data);
  });

  test("без паспорта — 404, некорректное тело — 422, чужое оборудование — 404", async () => {
    expect((await request(app).get(url())).status).toBe(404);
    expect((await request(app).get(url())).body.error.code).toBe("PASSPORT_NOT_FOUND");

    const invalid = await withKey(request(app).put(url())).send({
      manufacturer: "",
      ratedPowerKw: -1,
      lastInspectionAt: "вчера",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details.map((detail) => detail.field)).toEqual(
      expect.arrayContaining(["manufacturer", "model", "ratedPowerKw", "lastInspectionAt"]),
    );

    const missing = await withKey(
      request(app).put("/api/equipment/0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11/passport"),
    ).send(passportPayload());
    expect(missing.status).toBe(404);
  });

  test("DELETE убирает паспорт, а удаление оборудования уносит паспорт каскадом", async () => {
    await withKey(request(app).put(url())).send(passportPayload());

    expect((await withKey(request(app).delete(url()))).status).toBe(204);
    expect((await withKey(request(app).delete(url()))).status).toBe(404);

    await withKey(request(app).put(url())).send(passportPayload());
    expect((await withKey(request(app).delete(`/api/equipment/${equipment.id}`))).status).toBe(204);
    expect((await request(app).get(url())).status).toBe(404);
  });
});
