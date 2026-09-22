import { Op } from "sequelize";
import { getTestSequelize, captureQueries } from "./helpers/db.js";
import { getModels } from "../src/db/models/index.js";
import { createRepositories } from "../src/repositories/index.js";
import { buildWhere } from "../src/repositories/sequelize/where.js";

const equipmentData = (overrides = {}) => ({
  name: "Ветротурбина ВТ-01",
  type: "turbine",
  serialNumber: `WT-${Math.random().toString(36).slice(2, 8)}`,
  location: { lat: 44.95, lon: 34.1 },
  installedAt: "2024-05-10",
  ...overrides,
});

describe("перевод фильтров в where", () => {
  const { Equipment, MaintenanceRequest } = getModels(getTestSequelize());

  test("скаляр, список, диапазон и подстрока", () => {
    const where = buildWhere(Equipment, {
      type: "turbine",
      status: { in: ["operational", "fault"] },
      name: { contains: "50%_скидка" },
      serialNumber: undefined,
    });

    expect(where).toEqual({
      type: "turbine",
      status: { [Op.in]: ["operational", "fault"] },
      name: { [Op.iLike]: "%50\\%\\_скидка%" },
    });
  });

  test("дата без времени дополняется до полуночи UTC для timestamptz и усекается для date", () => {
    expect(
      buildWhere(MaintenanceRequest, {
        createdAt: { gte: "2026-01-01", lte: "2026-01-31T23:59:59.999Z" },
      }),
    ).toEqual({
      createdAt: { [Op.gte]: "2026-01-01T00:00:00.000Z", [Op.lte]: "2026-01-31T23:59:59.999Z" },
    });
    expect(buildWhere(Equipment, { installedAt: { lte: "2024-12-31T23:59:59.999Z" } })).toEqual({
      installedAt: { [Op.lte]: "2024-12-31" },
    });
  });

  test("$or раскрывается в Op.or, неизвестное поле отклоняется", () => {
    expect(buildWhere(Equipment, { $or: [{ name: "a" }, { serialNumber: "b" }] })).toEqual({
      [Op.or]: [{ name: "a" }, { serialNumber: "b" }],
    });
    expect(() => buildWhere(Equipment, { password: "x" })).toThrow(/неизвестное поле/);
    expect(() => buildWhere(Equipment, { status: { contains: "op" } })).toThrow(/подстроке/);
  });
});

describe("репозиторий на Sequelize", () => {
  let repositories;

  beforeEach(() => {
    repositories = createRepositories({ sequelize: getTestSequelize() });
  });

  test("create проставляет id и одинаковые метки времени, служебные поля из данных игнорирует", async () => {
    const { equipmentRepository } = repositories;

    const created = await equipmentRepository.create(
      equipmentData({ id: "не-uuid", createdAt: "2000-01-01T00:00:00.000Z" }),
    );

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBe(created.updatedAt);
    expect(created.createdAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(created.location).toEqual({ lat: 44.95, lon: 34.1 });
    expect(await equipmentRepository.findById(created.id)).toEqual(created);
  });

  test("список: подстрока без учёта регистра, диапазон дат, сортировка с NULLS LAST и пагинация", async () => {
    const { equipmentRepository, requestRepository } = repositories;
    const old = await equipmentRepository.create(
      equipmentData({ name: "Старая турбина", installedAt: "2019-03-01" }),
    );
    const fresh = await equipmentRepository.create(
      equipmentData({ name: "Новая турбина", installedAt: "2025-03-01" }),
    );
    await equipmentRepository.create(
      equipmentData({ name: "Инвертор", type: "inverter", installedAt: "2018-01-01" }),
    );

    const found = await equipmentRepository.list({
      filters: { $or: [{ name: { contains: "СТАР" } }, { serialNumber: { contains: "нет" } }] },
    });
    expect(found.items.map((item) => item.id)).toEqual([old.id]);

    const ranged = await equipmentRepository.list({
      filters: { installedAt: { gte: "2020-01-01", lte: "2025-12-31T23:59:59.999Z" } },
      sort: "installedAt",
      order: "asc",
    });
    expect(ranged.items.map((item) => item.id)).toEqual([fresh.id]);

    for (const plannedAt of [null, "2026-10-01T00:00:00Z", null, "2026-09-01T00:00:00Z"]) {
      await requestRepository.create({ equipmentId: old.id, title: "Осмотр гондолы", plannedAt });
    }
    const asc = await requestRepository.list({ sort: "plannedAt", order: "asc" });
    expect(asc.items.map((item) => item.plannedAt)).toEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
      null,
      null,
    ]);
    const desc = await requestRepository.list({ sort: "plannedAt", order: "desc", limit: 2 });
    expect(desc.items.map((item) => item.plannedAt)).toEqual([
      "2026-10-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    ]);
    expect(desc.total).toBe(4);
    const lastPage = await requestRepository.list({
      sort: "plannedAt",
      order: "desc",
      page: 2,
      limit: 3,
    });
    expect(lastPage.items).toHaveLength(1);
  });

  test("список читается двумя запросами: подсчёт и страница", async () => {
    const { equipmentRepository } = repositories;
    for (let i = 0; i < 5; i += 1) {
      await equipmentRepository.create(equipmentData());
    }

    const queries = await captureQueries(() => equipmentRepository.list({ limit: 3 }));

    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatch(/SELECT count/);
    expect(queries[1]).toMatch(/LIMIT 3/);
  });

  test("update и remove отвечают null и false для отсутствующей записи", async () => {
    const { equipmentRepository } = repositories;
    const missing = "0f1b6f0e-2f5e-4a60-9f7e-1c0b8d5b1a11";

    expect(await equipmentRepository.update(missing, { name: "Нет" })).toBeNull();
    expect(await equipmentRepository.remove(missing)).toBe(false);

    const created = await equipmentRepository.create(equipmentData());
    const updated = await equipmentRepository.update(created.id, { status: "fault" });
    expect(updated.status).toBe("fault");
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
    expect(await equipmentRepository.remove(created.id)).toBe(true);
    expect(await equipmentRepository.findById(created.id)).toBeNull();
  });

  test("transaction откатывает все изменения при исключении", async () => {
    const { equipmentRepository, transaction } = repositories;

    await expect(
      transaction(async (t) => {
        await equipmentRepository.create(equipmentData(), { transaction: t });
        await equipmentRepository.create(equipmentData(), { transaction: t });
        throw new Error("намеренный сбой");
      }),
    ).rejects.toThrow("намеренный сбой");

    expect(await equipmentRepository.count()).toBe(0);
  });
});
