import request from "supertest";
import { buildApp, equipmentPayload, requestPayload, withKey } from "./helpers/app.js";

let app;

beforeEach(async () => {
  ({ app } = await buildApp());
});

async function createEquipment(overrides) {
  const res = await withKey(request(app).post("/api/equipment")).send(equipmentPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.data;
}

describe("POST /api/equipment", () => {
  test("создаёт оборудование, возвращает 201 и заголовок Location", async () => {
    const res = await withKey(request(app).post("/api/equipment")).send(equipmentPayload());

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/equipment/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      name: "Ветротурбина ВТ-01",
      type: "turbine",
      status: "operational",
      location: { lat: 55.75, lon: 37.61 },
    });
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
  });

  test("игнорирует неизвестные и служебные поля", async () => {
    const res = await withKey(request(app).post("/api/equipment")).send(
      equipmentPayload({ id: "custom-id", createdAt: "2000-01-01", vendor: "ACME" }),
    );

    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe("custom-id");
    expect(res.body.data.createdAt).not.toBe("2000-01-01");
    expect(res.body.data.vendor).toBeUndefined();
  });

  test("возвращает 422 с перечнем полей при некорректном теле", async () => {
    const res = await withKey(request(app).post("/api/equipment")).send({
      name: "ab",
      type: "drone",
      location: { lat: 100 },
      installedAt: "2999-01-01",
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.requestId).toBeDefined();
    const fields = res.body.error.details.map((detail) => detail.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "name",
        "type",
        "serialNumber",
        "location.lat",
        "location.lon",
        "installedAt",
      ]),
    );
  });

  test("возвращает 409 при дубле серийного номера", async () => {
    await createEquipment({ serialNumber: "WT-DUP" });
    const res = await withKey(request(app).post("/api/equipment")).send(
      equipmentPayload({ serialNumber: "WT-DUP" }),
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SERIAL_NUMBER_TAKEN");
  });
});

describe("GET /api/equipment", () => {
  test("возвращает список с метаданными, фильтрует и сортирует", async () => {
    await createEquipment({ name: "Турбина А", type: "turbine", installedAt: "2023-01-01" });
    await createEquipment({ name: "Турбина Б", type: "turbine", installedAt: "2024-01-01" });
    await createEquipment({ name: "Датчик", type: "sensor", installedAt: "2024-06-01" });

    const res = await request(app).get("/api/equipment").query({
      type: "turbine",
      sort: "installedAt",
      order: "asc",
      limit: 1,
      page: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ total: 2, page: 2, limit: 1, pages: 2 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Турбина Б");
  });

  test("фильтрует по диапазону дат установки и подстроке", async () => {
    await createEquipment({ name: "Старая турбина", installedAt: "2020-01-01" });
    await createEquipment({ name: "Новая турбина", installedAt: "2024-01-01" });

    const byDate = await request(app)
      .get("/api/equipment")
      .query({ installedFrom: "2023-01-01", installedTo: "2024-12-31" });
    expect(byDate.body.meta.total).toBe(1);
    expect(byDate.body.data[0].name).toBe("Новая турбина");

    const bySearch = await request(app).get("/api/equipment").query({ q: "стар" });
    expect(bySearch.body.meta.total).toBe(1);
    expect(bySearch.body.data[0].name).toBe("Старая турбина");
  });

  test("возвращает 400 при некорректных параметрах запроса", async () => {
    const res = await request(app).get("/api/equipment").query({ page: 0, limit: 500, sort: "x" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((detail) => detail.field)).toEqual(
      expect.arrayContaining(["page", "limit", "sort"]),
    );
    expect(res.body.error.details.every((detail) => detail.location === "query")).toBe(true);
  });
});

describe("GET /api/equipment/:id", () => {
  test("возвращает карточку оборудования", async () => {
    const created = await createEquipment();
    const res = await request(app).get(`/api/equipment/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(created);
  });

  test("возвращает 404 для несуществующего идентификатора", async () => {
    const res = await request(app).get("/api/equipment/0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  test("возвращает 400 для идентификатора не в формате UUID", async () => {
    const res = await request(app).get("/api/equipment/123");

    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ field: "id", location: "params" });
  });
});

describe("PATCH /api/equipment/:id", () => {
  test("частично обновляет поля и не трогает служебные", async () => {
    const created = await createEquipment();
    const res = await withKey(request(app).patch(`/api/equipment/${created.id}`)).send({
      status: "maintenance",
      id: "hacked",
      createdAt: "2000-01-01",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("maintenance");
    expect(res.body.data.id).toBe(created.id);
    expect(res.body.data.createdAt).toBe(created.createdAt);
    expect(res.body.data.name).toBe(created.name);
  });

  test("возвращает 422 при пустом теле", async () => {
    const created = await createEquipment();
    const res = await withKey(request(app).patch(`/api/equipment/${created.id}`)).send({});

    expect(res.status).toBe(422);
  });

  test("возвращает 409 при смене серийного номера на занятый", async () => {
    await createEquipment({ serialNumber: "WT-A" });
    const second = await createEquipment({ serialNumber: "WT-B" });
    const res = await withKey(request(app).patch(`/api/equipment/${second.id}`)).send({
      serialNumber: "WT-A",
    });

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/equipment/:id", () => {
  test("удаляет оборудование без заявок и возвращает 204", async () => {
    const created = await createEquipment();
    const res = await withKey(request(app).delete(`/api/equipment/${created.id}`));

    expect(res.status).toBe(204);
    expect((await request(app).get(`/api/equipment/${created.id}`)).status).toBe(404);
  });

  test("возвращает 409, если есть открытые заявки", async () => {
    const created = await createEquipment();
    await withKey(request(app).post("/api/requests")).send(requestPayload(created.id));

    const res = await withKey(request(app).delete(`/api/equipment/${created.id}`));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EQUIPMENT_HAS_OPEN_REQUESTS");
  });

  test("разрешает удаление, когда все заявки закрыты", async () => {
    const created = await createEquipment();
    const req = await withKey(request(app).post("/api/requests")).send(requestPayload(created.id));
    await withKey(request(app).patch(`/api/requests/${req.body.data.id}/status`)).send({
      status: "rejected",
    });

    const res = await withKey(request(app).delete(`/api/equipment/${created.id}`));

    expect(res.status).toBe(204);
  });
});
