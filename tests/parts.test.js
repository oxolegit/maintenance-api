import request from "supertest";
import { buildApp, equipmentPayload, requestPayload, withKey } from "./helpers/app.js";

const partPayload = (overrides = {}) => ({
  name: "Подшипник главного вала",
  sku: `BRG-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  unit: "шт",
  stockQty: 10,
  ...overrides,
});

describe("запчасти и их списание на заявку", () => {
  let app;
  let maintenance;

  const create = async (path, payload) =>
    (await withKey(request(app).post(path)).send(payload)).body.data;
  const writeOff = (items, id = maintenance.id) =>
    withKey(request(app).post(`/api/requests/${id}/parts`)).send({ items });
  const stockOf = async (part) =>
    (await request(app).get(`/api/parts/${part.id}`)).body.data.stockQty;

  beforeEach(async () => {
    ({ app } = await buildApp());
    const equipment = await create("/api/equipment", equipmentPayload());
    maintenance = await create("/api/requests", requestPayload(equipment.id));
  });

  test("CRUD справочника: артикул уникален, остаток задаётся приходом", async () => {
    const created = await withKey(request(app).post("/api/parts")).send(
      partPayload({ sku: "brg-23148" }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ sku: "BRG-23148", unit: "шт", stockQty: 10 });

    const duplicate = await withKey(request(app).post("/api/parts")).send(
      partPayload({ sku: "BRG-23148" }),
    );
    expect(duplicate.status).toBe(409);

    const restocked = await withKey(request(app).patch(`/api/parts/${created.body.data.id}`)).send({
      stockQty: 25,
    });
    expect(restocked.body.data.stockQty).toBe(25);

    await create("/api/parts", partPayload({ name: "Фильтр", stockQty: 0 }));
    const inStock = await request(app).get("/api/parts?inStock=true");
    expect(inStock.body.data.map((item) => item.name)).toEqual(["Подшипник главного вала"]);
    const search = await request(app).get("/api/parts?q=фильтр");
    expect(search.body.meta.total).toBe(1);

    const invalid = await withKey(request(app).post("/api/parts")).send({ sku: "!", stockQty: -1 });
    expect(invalid.status).toBe(422);
  });

  test("списание уменьшает остаток и накапливает количество по заявке", async () => {
    const bearing = await create("/api/parts", partPayload({ stockQty: 5 }));
    const oil = await create(
      "/api/parts",
      partPayload({ name: "Масло", unit: "л", stockQty: 100 }),
    );

    const res = await writeOff([
      { partId: bearing.id, quantity: 2 },
      { partId: oil.id, quantity: 40 },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.data.map((item) => [item.part.sku, item.quantity, item.part.stockQty])).toEqual(
      expect.arrayContaining([
        [bearing.sku, 2, 3],
        [oil.sku, 40, 60],
      ]),
    );

    await writeOff([{ partId: bearing.id, quantity: 1 }]);
    const usage = await request(app).get(`/api/requests/${maintenance.id}/parts`);
    const line = usage.body.data.find((item) => item.partId === bearing.id);
    expect(line.quantity).toBe(3);
    expect(await stockOf(bearing)).toBe(2);
  });

  test("нехватка одной позиции откатывает списание целиком", async () => {
    const bearing = await create("/api/parts", partPayload({ stockQty: 5 }));
    const blade = await create("/api/parts", partPayload({ name: "Лопасть", stockQty: 1 }));

    const res = await writeOff([
      { partId: bearing.id, quantity: 2 },
      { partId: blade.id, quantity: 2 },
    ]);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.error.details[0].message).toMatch(/запрошено 2, на складе 1/);
    expect(await stockOf(bearing)).toBe(5);
    expect(await stockOf(blade)).toBe(1);
    expect((await request(app).get(`/api/requests/${maintenance.id}/parts`)).body.data).toEqual([]);
  });

  test("неизвестная запчасть — 404, закрытая заявка — 409, тело проверяется", async () => {
    const bearing = await create("/api/parts", partPayload());
    const missing = await writeOff([
      { partId: bearing.id, quantity: 1 },
      { partId: "0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11", quantity: 1 },
    ]);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("PART_NOT_FOUND");
    expect(await stockOf(bearing)).toBe(10);

    await withKey(request(app).patch(`/api/requests/${maintenance.id}/status`)).send({
      status: "rejected",
    });
    const closed = await writeOff([{ partId: bearing.id, quantity: 1 }]);
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe("REQUEST_CLOSED");

    expect((await writeOff([{ partId: bearing.id, quantity: 0 }])).status).toBe(422);
    expect((await writeOff([])).status).toBe(422);
  });

  test("параллельные списания не уводят остаток в минус", async () => {
    const bearing = await create("/api/parts", partPayload({ stockQty: 10 }));
    const equipment = await create("/api/equipment", equipmentPayload());
    const requests = await Promise.all(
      Array.from({ length: 5 }, () => create("/api/requests", requestPayload(equipment.id))),
    );

    const results = await Promise.all(
      requests.map((item) => writeOff([{ partId: bearing.id, quantity: 3 }], item.id)),
    );

    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 201, 201, 409, 409]);
    expect(await stockOf(bearing)).toBe(1);
  });

  test("возврат позиции восстанавливает остаток; запчасть с расходом не удаляется", async () => {
    const bearing = await create("/api/parts", partPayload({ stockQty: 5 }));
    await writeOff([{ partId: bearing.id, quantity: 2 }]);

    const inUse = await withKey(request(app).delete(`/api/parts/${bearing.id}`));
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe("PART_IN_USE");

    const url = `/api/requests/${maintenance.id}/parts/${bearing.id}`;
    expect((await withKey(request(app).delete(url))).status).toBe(204);
    expect((await withKey(request(app).delete(url))).status).toBe(404);
    expect(await stockOf(bearing)).toBe(5);
    expect((await withKey(request(app).delete(`/api/parts/${bearing.id}`))).status).toBe(204);
  });
});
