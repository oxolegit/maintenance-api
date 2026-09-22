import request from "supertest";
import { buildApp, equipmentPayload, requestPayload, withKey } from "./helpers/app.js";
import { getTestSequelize } from "./helpers/db.js";
import { getModels } from "../src/db/models/index.js";

const sitePayload = (overrides = {}) => ({
  name: "Останинская ВЭС",
  code: `OST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  region: "Крым, Ленинский район",
  location: { lat: 45.3107, lon: 35.7745 },
  ...overrides,
});

describe("/api/sites", () => {
  let app;

  beforeEach(async () => {
    ({ app } = await buildApp());
  });

  const createSite = async (overrides) =>
    (await withKey(request(app).post("/api/sites")).send(sitePayload(overrides))).body.data;

  test("создаёт площадку и отдаёт её карточку", async () => {
    const res = await withKey(request(app).post("/api/sites")).send(sitePayload({ code: "ost" }));

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/sites/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      code: "OST",
      region: "Крым, Ленинский район",
      location: { lat: 45.3107, lon: 35.7745 },
    });

    const card = await request(app).get(`/api/sites/${res.body.data.id}`);
    expect(card.body.data).toEqual(res.body.data);
  });

  test("код площадки уникален, тело проверяется", async () => {
    await createSite({ code: "TRH" });

    const duplicate = await withKey(request(app).post("/api/sites")).send(
      sitePayload({ code: "trh" }),
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.details).toEqual([
      { field: "code", message: "Значение уже используется" },
    ]);

    const invalid = await withKey(request(app).post("/api/sites")).send({
      name: "А",
      code: "слишком длинный код!",
      location: { lat: 100 },
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details.map((detail) => detail.field)).toEqual(
      expect.arrayContaining(["name", "code", "region", "location.lon"]),
    );
  });

  test("список с поиском и фильтром по региону, частичное обновление", async () => {
    const site = await createSite({ name: "Тарханкутская ВЭС", region: "Черноморский район" });
    await createSite({ name: "Донузлавская ВЭС", region: "Сакский район" });

    const found = await request(app).get("/api/sites?q=тархан&sort=name&order=asc");
    expect(found.body.data.map((item) => item.id)).toEqual([site.id]);
    const byRegion = await request(app).get("/api/sites?region=сакский");
    expect(byRegion.body.meta.total).toBe(1);

    const patched = await withKey(request(app).patch(`/api/sites/${site.id}`)).send({
      region: "Крым, Черноморский район",
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.region).toBe("Крым, Черноморский район");
  });

  test("оборудование привязывается к площадке, площадка с оборудованием не удаляется", async () => {
    const site = await createSite();
    const missingSite = await withKey(request(app).post("/api/equipment")).send(
      equipmentPayload({ siteId: "0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11" }),
    );
    expect(missingSite.status).toBe(404);
    expect(missingSite.body.error.code).toBe("SITE_NOT_FOUND");

    const equipment = await withKey(request(app).post("/api/equipment")).send(
      equipmentPayload({ siteId: site.id }),
    );
    expect(equipment.status).toBe(201);
    expect(equipment.body.data.site).toEqual({ id: site.id, name: site.name, code: site.code });
    expect(equipment.body.data.passport).toBeNull();

    const nested = await request(app).get(`/api/sites/${site.id}/equipment`);
    expect(nested.body.data.map((item) => item.id)).toEqual([equipment.body.data.id]);
    const filtered = await request(app).get(`/api/equipment?siteId=${site.id}`);
    expect(filtered.body.meta.total).toBe(1);

    const blocked = await withKey(request(app).delete(`/api/sites/${site.id}`));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("SITE_HAS_EQUIPMENT");

    await withKey(request(app).delete(`/api/equipment/${equipment.body.data.id}`));
    expect((await withKey(request(app).delete(`/api/sites/${site.id}`))).status).toBe(204);
    expect((await request(app).get(`/api/sites/${site.id}`)).status).toBe(404);
  });

  test("сводка по площадке: заявки по статусам и приоритетам, среднее время закрытия", async () => {
    const site = await createSite();
    const { MaintenanceRequest, RequestStatusHistory } = getModels(getTestSequelize());
    const create = async (payload) =>
      (await withKey(request(app).post("/api/equipment")).send(equipmentPayload(payload))).body
        .data;
    const first = await create({ siteId: site.id });
    const second = await create({ siteId: site.id });
    const elsewhere = await create();

    const make = async (equipmentId, overrides) =>
      (
        await withKey(request(app).post("/api/requests")).send(
          requestPayload(equipmentId, overrides),
        )
      ).body.data;
    const done1 = await make(first.id, { priority: "high" });
    const done2 = await make(second.id, { priority: "low" });
    await make(first.id, { priority: "critical" });
    await make(elsewhere.id, { priority: "critical" });

    // закрытые заявки: журнал фиксирует done через 10 и 30 часов после создания
    for (const [row, hours] of [
      [done1, 10],
      [done2, 30],
    ]) {
      await MaintenanceRequest.update({ status: "done" }, { where: { id: row.id } });
      await RequestStatusHistory.create({
        requestId: row.id,
        previousStatus: "in_progress",
        newStatus: "done",
        author: "test",
        changedAt: new Date(new Date(row.createdAt).getTime() + hours * 3600 * 1000),
      });
    }

    const res = await request(app).get(`/api/sites/${site.id}/summary`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      siteId: site.id,
      siteName: site.name,
      period: { from: null, to: null },
      total: 3,
      open: 1,
      byStatus: { new: 1, in_progress: 0, done: 2, rejected: 0 },
      byPriority: { low: 1, medium: 0, high: 1, critical: 1 },
      closed: 2,
      avgCloseHours: 20,
    });

    const empty = await request(app).get(`/api/sites/${site.id}/summary?from=2030-01-01`);
    expect(empty.body.data).toMatchObject({ total: 0, closed: 0, avgCloseHours: null });
    const badPeriod = await request(app).get(`/api/sites/${site.id}/summary?from=вчера`);
    expect(badPeriod.status).toBe(400);
  });
});
