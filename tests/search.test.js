import request from "supertest";
import { buildApp, equipmentPayload, requestPayload, withKey } from "./helpers/app.js";
import { getTestSequelize } from "./helpers/db.js";

describe("поиск по подстроке и индексы", () => {
  let app;

  beforeEach(async () => {
    ({ app } = await buildApp());
  });

  test("q в списке заявок ищет по теме и описанию без учёта регистра", async () => {
    const equipment = (await withKey(request(app).post("/api/equipment")).send(equipmentPayload()))
      .body.data;
    const create = (overrides) =>
      withKey(request(app).post("/api/requests")).send(requestPayload(equipment.id, overrides));
    const byTitle = (await create({ title: "Балансировка ротора" })).body.data;
    const byDescription = (
      await create({ title: "Плановый осмотр", description: "проверить балансировку" })
    ).body.data;
    await create({ title: "Замена анемометра" });

    const res = await request(app).get("/api/requests?q=БАЛАНС&sort=title&order=asc");

    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map((item) => item.id)).toEqual([byTitle.id, byDescription.id]);
    expect(
      (await request(app).get(`/api/equipment/${equipment.id}/requests?q=анемо`)).body.meta.total,
    ).toBe(1);
    expect((await request(app).get(`/api/requests?q=${"x".repeat(101)}`)).status).toBe(400);
  });

  test("в схеме есть индексы под фильтры и триграммные индексы для ILIKE", async () => {
    const rows = await getTestSequelize().query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname",
      { type: "SELECT" },
    );
    const names = rows.map((row) => row.indexname);

    expect(names).toEqual(
      expect.arrayContaining([
        "maintenance_requests_status_idx",
        "maintenance_requests_created_at_idx",
        "maintenance_requests_equipment_id_status_idx",
        "equipment_status_idx",
        "equipment_name_trgm_idx",
        "maintenance_requests_title_trgm_idx",
        "technicians_full_name_trgm_idx",
      ]),
    );
    const trgm = rows.find((row) => row.indexname === "maintenance_requests_title_trgm_idx");
    expect(trgm.indexdef).toMatch(/USING gin \(title gin_trgm_ops\)/);
  });
});
