import request from "supertest";
import { buildApp, equipmentPayload, requestPayload, withKey } from "./helpers/app.js";

let app;
let equipment;

beforeEach(async () => {
  ({ app } = await buildApp());
  const res = await withKey(request(app).post("/api/equipment")).send(equipmentPayload());
  equipment = res.body.data;
});

async function createRequest(overrides) {
  const res = await withKey(request(app).post("/api/requests")).send(
    requestPayload(equipment.id, overrides),
  );
  expect(res.status).toBe(201);
  return res.body.data;
}

async function setStatus(id, status) {
  return withKey(request(app).patch(`/api/requests/${id}/status`)).send({ status });
}

describe("POST /api/requests", () => {
  test("создаёт заявку со статусом new и значениями по умолчанию", async () => {
    const res = await withKey(request(app).post("/api/requests")).send({
      equipmentId: equipment.id,
      title: "Диагностика редуктора",
      status: "done",
    });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/requests/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      equipmentId: equipment.id,
      title: "Диагностика редуктора",
      description: "",
      priority: "medium",
      plannedAt: null,
      status: "new",
    });
  });

  test("возвращает 404, если оборудование не существует", async () => {
    const res = await withKey(request(app).post("/api/requests")).send(
      requestPayload("0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11"),
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("EQUIPMENT_NOT_FOUND");
  });

  test("возвращает 422 при некорректных полях", async () => {
    const res = await withKey(request(app).post("/api/requests")).send({
      equipmentId: "abc",
      title: "Кор",
      priority: "urgent",
      plannedAt: "завтра",
    });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((detail) => detail.field)).toEqual(
      expect.arrayContaining(["equipmentId", "title", "priority", "plannedAt"]),
    );
  });

  test("возвращает 409 для списанного оборудования", async () => {
    await withKey(request(app).patch(`/api/equipment/${equipment.id}`)).send({
      status: "decommissioned",
    });
    const res = await withKey(request(app).post("/api/requests")).send(
      requestPayload(equipment.id),
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EQUIPMENT_DECOMMISSIONED");
  });
});

describe("GET /api/requests и вложенный ресурс", () => {
  test("фильтрует по статусу, приоритету, оборудованию и датам", async () => {
    const other = (
      await withKey(request(app).post("/api/equipment")).send(equipmentPayload({ name: "Второе" }))
    ).body.data;
    const first = await createRequest({ priority: "low", plannedAt: "2026-10-01T08:00:00Z" });
    await createRequest({ priority: "critical", plannedAt: "2026-11-01T08:00:00Z" });
    await withKey(request(app).post("/api/requests")).send(requestPayload(other.id));
    await setStatus(first.id, "in_progress");

    const byStatus = await request(app).get("/api/requests").query({ status: "in_progress" });
    expect(byStatus.body.meta.total).toBe(1);
    expect(byStatus.body.data[0].id).toBe(first.id);

    const byPriority = await request(app).get("/api/requests").query({ priority: "critical" });
    expect(byPriority.body.meta.total).toBe(1);

    const byEquipment = await request(app)
      .get("/api/requests")
      .query({ equipmentId: equipment.id });
    expect(byEquipment.body.meta.total).toBe(2);

    const byPlanned = await request(app)
      .get("/api/requests")
      .query({ plannedFrom: "2026-10-15", plannedTo: "2026-12-31" });
    expect(byPlanned.body.meta.total).toBe(1);
    expect(byPlanned.body.data[0].priority).toBe("critical");

    const nested = await request(app).get(`/api/equipment/${other.id}/requests`);
    expect(nested.status).toBe(200);
    expect(nested.body.meta.total).toBe(1);
    expect(nested.body.data[0].equipmentId).toBe(other.id);
  });

  test("вложенный ресурс возвращает 404 для несуществующего оборудования", async () => {
    const res = await request(app).get(
      "/api/equipment/0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11/requests",
    );

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/requests/:id", () => {
  test("обновляет поля, но не статус и не оборудование", async () => {
    const created = await createRequest();
    const res = await withKey(request(app).patch(`/api/requests/${created.id}`)).send({
      description: "Слышен стук в гондоле",
      plannedAt: "2026-09-25T09:00:00Z",
      status: "done",
      equipmentId: "0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe("Слышен стук в гондоле");
    // дата-время нормализуется к UTC с миллисекундами, как и все метки времени из БД
    expect(res.body.data.plannedAt).toBe("2026-09-25T09:00:00.000Z");
    expect(res.body.data.status).toBe("new");
    expect(res.body.data.equipmentId).toBe(equipment.id);
    expect(res.body.data.updatedAt >= created.updatedAt).toBe(true);
  });

  test("возвращает 404 для несуществующей заявки", async () => {
    const res = await withKey(
      request(app).patch("/api/requests/0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11"),
    ).send({ title: "Новое название" });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/requests/:id/status", () => {
  test("проводит заявку по допустимым переходам", async () => {
    const created = await createRequest();

    const inProgress = await setStatus(created.id, "in_progress");
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.data.status).toBe("in_progress");

    const done = await setStatus(created.id, "done");
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe("done");
  });

  test.each([
    ["new", "done"],
    ["new", "new"],
    ["in_progress", "new"],
    ["done", "rejected"],
    ["done", "in_progress"],
    ["rejected", "new"],
  ])("отклоняет переход %s → %s с кодом 409", async (from, to) => {
    const created = await createRequest();
    if (from === "in_progress" || from === "done") await setStatus(created.id, "in_progress");
    if (from === "done") await setStatus(created.id, "done");
    if (from === "rejected") await setStatus(created.id, "rejected");

    const res = await setStatus(created.id, to);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(res.body.error.details[0].field).toBe("status");
  });

  test("возвращает 422 при неизвестном статусе", async () => {
    const created = await createRequest();
    const res = await setStatus(created.id, "closed");

    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/requests/:id", () => {
  test("удаляет заявку и возвращает 204, повторное удаление — 404", async () => {
    const created = await createRequest();

    expect((await withKey(request(app).delete(`/api/requests/${created.id}`))).status).toBe(204);
    expect((await withKey(request(app).delete(`/api/requests/${created.id}`))).status).toBe(404);
  });
});
