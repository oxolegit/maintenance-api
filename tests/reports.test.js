import request from "supertest";
import {
  buildApp,
  equipmentPayload,
  requestPayload,
  technicianPayload,
  withKey,
} from "./helpers/app.js";
import { getTestSequelize, captureQueries } from "./helpers/db.js";
import { getModels } from "../src/db/models/index.js";

describe("GET /api/reports/equipment-load", () => {
  let app;
  let turbine;
  let inverter;
  let idle;
  let site;

  const create = async (path, payload) =>
    (await withKey(request(app).post(path)).send(payload)).body.data;

  // Фикстура: турбина — 3 заявки (2 закрыты, бригады 12 и 6 часов), инвертор — 1 заявка
  // в работе (4 часа), третья единица без заявок
  beforeEach(async () => {
    ({ app } = await buildApp());
    const { MaintenanceRequest, RequestStatusHistory } = getModels(getTestSequelize());
    site = await create("/api/sites", {
      name: "Останинская ВЭС",
      code: "OST",
      region: "Крым",
      location: { lat: 45.31, lon: 35.77 },
    });
    turbine = await create(
      "/api/equipment",
      equipmentPayload({ name: "Турбина", siteId: site.id }),
    );
    inverter = await create(
      "/api/equipment",
      equipmentPayload({ name: "Инвертор", type: "inverter" }),
    );
    idle = await create("/api/equipment", equipmentPayload({ name: "Датчик", type: "sensor" }));
    const lead = await create("/api/technicians", technicianPayload());
    const member = await create("/api/technicians", technicianPayload());

    const assign = (id, hours) =>
      withKey(request(app).post(`/api/requests/${id}/assignees`)).send({
        assignees: [
          { technicianId: lead.id, role: "lead", hours },
          { technicianId: member.id, role: "member", hours },
        ],
      });
    const closeAt = async (id, date) => {
      await MaintenanceRequest.update({ status: "done" }, { where: { id } });
      await RequestStatusHistory.create({
        requestId: id,
        previousStatus: "in_progress",
        newStatus: "done",
        author: "test",
        changedAt: new Date(date),
      });
    };

    const first = await create("/api/requests", requestPayload(turbine.id));
    await assign(first.id, 6);
    await closeAt(first.id, "2026-06-10T10:00:00Z");
    const second = await create("/api/requests", requestPayload(turbine.id));
    await assign(second.id, 3);
    await closeAt(second.id, "2026-08-01T10:00:00Z");
    await create("/api/requests", requestPayload(turbine.id));

    const third = await create("/api/requests", requestPayload(inverter.id));
    await assign(third.id, 2);
    await withKey(request(app).patch(`/api/requests/${third.id}/status`)).send({
      status: "in_progress",
    });
  });

  test("считает заявки, закрытые, плановые часы и дату последнего обслуживания по единице", async () => {
    const res = await request(app).get("/api/reports/equipment-load");

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ total: 2, page: 1, limit: 20, pages: 1 });
    expect(res.body.data).toEqual([
      {
        equipmentId: turbine.id,
        name: "Турбина",
        serialNumber: turbine.serialNumber,
        type: "turbine",
        status: "operational",
        site: { id: site.id, name: "Останинская ВЭС" },
        requestsTotal: 3,
        requestsDone: 2,
        requestsOpen: 1,
        plannedHours: 18,
        lastMaintenanceAt: "2026-08-01T10:00:00.000Z",
      },
      {
        equipmentId: inverter.id,
        name: "Инвертор",
        serialNumber: inverter.serialNumber,
        type: "inverter",
        status: "operational",
        site: null,
        requestsTotal: 1,
        requestsDone: 0,
        requestsOpen: 1,
        plannedHours: 4,
        lastMaintenanceAt: null,
      },
    ]);
  });

  test("minRequests фильтрует группы (HAVING), ноль показывает оборудование без заявок", async () => {
    const heavy = await request(app).get("/api/reports/equipment-load?minRequests=2");
    expect(heavy.body.data.map((item) => item.equipmentId)).toEqual([turbine.id]);

    const all = await request(app).get(
      "/api/reports/equipment-load?minRequests=0&sort=name&order=asc",
    );
    expect(all.body.data.map((item) => [item.name, item.requestsTotal])).toEqual([
      ["Датчик", 0],
      ["Инвертор", 1],
      ["Турбина", 3],
    ]);
    expect(all.body.data[0].equipmentId).toBe(idle.id);
  });

  test("период отсекает заявки по дате создания, площадка — по оборудованию", async () => {
    const future = await request(app).get("/api/reports/equipment-load?from=2030-01-01");
    expect(future.body.data).toEqual([]);

    const bySite = await request(app).get(`/api/reports/equipment-load?siteId=${site.id}`);
    expect(bySite.body.data.map((item) => item.equipmentId)).toEqual([turbine.id]);
  });

  test("сортировка только по белому списку, параметры периода и пагинации проверяются", async () => {
    const byHours = await request(app).get(
      "/api/reports/equipment-load?sort=plannedHours&order=asc&limit=1&page=2",
    );
    expect(byHours.body.data.map((item) => item.plannedHours)).toEqual([18]);
    expect(byHours.body.meta).toEqual({ total: 2, page: 2, limit: 1, pages: 2 });

    for (const query of [
      "sort=e.name;DROP TABLE equipment",
      "from=2026-12-01&to=2026-01-01",
      "minRequests=-1",
      "limit=500",
      "page=99999",
    ]) {
      const res = await request(app).get(`/api/reports/equipment-load?${query}`);
      expect([query, res.status]).toEqual([query, 400]);
    }
  });

  test("отчёт выполняется двумя запросами: страница и подсчёт групп", async () => {
    const queries = await captureQueries(() => request(app).get("/api/reports/equipment-load"));

    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatch(/HAVING COUNT\(r\.id\) >= \$4/);
    expect(queries[0]).toMatch(/GROUP BY e\.id, s\.id/);
  });
});
