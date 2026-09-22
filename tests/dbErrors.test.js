import request from "supertest";
import { getTestSequelize } from "./helpers/db.js";
import { getModels } from "../src/db/models/index.js";
import { mapDbError } from "../src/db/errors.js";
import { buildApp, equipmentPayload, withKey } from "./helpers/app.js";

const SITE_ID = "11111111-1111-4111-8111-111111111111";
const MISSING_ID = "0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11";

async function caught(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("ожидалась ошибка");
}

describe("преобразование ошибок БД", () => {
  const sequelize = getTestSequelize();
  const { Site, Equipment, MaintenanceRequest } = getModels(sequelize);

  test("нарушение уникальности → 409 с именем поля", async () => {
    await Site.create({ name: "А", code: "SITE", region: "Крым", latitude: 1, longitude: 1 });
    const error = await caught(
      Site.create({ name: "Б", code: "SITE", region: "Крым", latitude: 1, longitude: 1 }),
    );

    const mapped = mapDbError(error);
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe("UNIQUE_VIOLATION");
    expect(mapped.details).toEqual([{ field: "code", message: "Значение уже используется" }]);
  });

  test("ссылка на отсутствующую запись → 404, удаление используемой записи → 409", async () => {
    const missingParent = await caught(
      Equipment.create({
        siteId: MISSING_ID,
        name: "Турбина",
        type: "turbine",
        serialNumber: "S-1",
        latitude: 1,
        longitude: 1,
        installedAt: "2024-01-01",
      }),
    );
    const notFound = mapDbError(missingParent);
    expect(notFound.status).toBe(404);
    expect(notFound.code).toBe("RELATED_NOT_FOUND");
    expect(notFound.details).toEqual([{ field: "siteId", message: "Запись не найдена" }]);

    await Site.create({
      id: SITE_ID,
      name: "А",
      code: "S",
      region: "Крым",
      latitude: 1,
      longitude: 1,
    });
    await Equipment.create({
      siteId: SITE_ID,
      name: "Турбина",
      type: "turbine",
      serialNumber: "S-2",
      latitude: 1,
      longitude: 1,
      installedAt: "2024-01-01",
    });
    const inUse = mapDbError(await caught(Site.destroy({ where: { id: SITE_ID } })));
    expect(inUse.status).toBe(409);
    expect(inUse.code).toBe("RESOURCE_IN_USE");
    expect(inUse.details).toEqual([
      { field: "id", message: "на запись ссылается таблица equipment" },
    ]);
  });

  test("check-ограничение → 422, неверный литерал → 400, триггер журнала → 409", async () => {
    const check = mapDbError(
      await caught(
        sequelize.query(
          "INSERT INTO request_assignees (request_id, technician_id, role, hours) VALUES ($1, $1, 'lead', 0)",
          { bind: [MISSING_ID] },
        ),
      ),
    );
    expect(check.status).toBe(422);
    expect(check.details[0].field).toBe("request_assignees_hours_positive");

    const literal = mapDbError(
      await caught(MaintenanceRequest.findOne({ where: { id: "не-uuid" } })),
    );
    expect(literal.status).toBe(400);

    const equipment = await Equipment.create({
      name: "Турбина",
      type: "turbine",
      serialNumber: "S-3",
      latitude: 1,
      longitude: 1,
      installedAt: "2024-01-01",
    });
    const request = await MaintenanceRequest.create({ equipmentId: equipment.id, title: "Осмотр" });
    await sequelize.query(
      "INSERT INTO request_status_history (request_id, new_status, author) VALUES ($1, 'new', 't')",
      { bind: [request.id] },
    );
    const trigger = mapDbError(await caught(sequelize.query("DELETE FROM request_status_history")));
    expect(trigger.status).toBe(409);
    expect(trigger.code).toBe("HISTORY_IMMUTABLE");
  });

  test("ошибка соединения → 503, прочие ошибки не перехватываются", () => {
    const unreachable = mapDbError(
      Object.assign(new sequelize.Sequelize.ConnectionError(new Error("ECONNREFUSED")), {}),
    );
    expect(unreachable.status).toBe(503);
    expect(unreachable.code).toBe("DB_UNAVAILABLE");
    expect(mapDbError(new Error("обычная"))).toBeNull();
  });

  test("обработчик ошибок отдаёт ошибку БД в едином формате", async () => {
    const { app, repositories } = await buildApp();
    repositories.equipmentRepository.findBySerialNumber = async () => null;
    await withKey(request(app).post("/api/equipment")).send(
      equipmentPayload({ serialNumber: "DUP" }),
    );

    const res = await withKey(request(app).post("/api/equipment")).send(
      equipmentPayload({ serialNumber: "DUP" }),
    );

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "UNIQUE_VIOLATION",
      details: [{ field: "serialNumber", message: "Значение уже используется" }],
      requestId: expect.any(String),
    });
  });
});
