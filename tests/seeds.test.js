import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getTestSequelize } from "./helpers/db.js";
import { getModels } from "../src/db/models/index.js";
import { createSeeder } from "../src/db/migrator.js";
import { importJson } from "../src/db/importJson.js";

const LEGACY_EQUIPMENT = {
  id: "7c1c2a0e-9b1c-4f2a-9a55-1d2f3e4a5b6c",
  name: "Ветротурбина ВТ-01",
  type: "turbine",
  serialNumber: "WT-LEGACY-001",
  location: { lat: 44.9521, lon: 34.1024 },
  status: "maintenance",
  installedAt: "2024-05-10",
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-17T12:30:00.000Z",
};

const LEGACY_REQUEST = {
  id: "8d2d3b1f-0c2d-4a3b-8b66-2e3f4a5b6c7d",
  equipmentId: LEGACY_EQUIPMENT.id,
  title: "Замена подшипника главного вала",
  description: "Вибрация выше нормы",
  priority: "high",
  status: "in_progress",
  plannedAt: "2026-10-05T09:00:00Z",
  createdAt: "2026-09-16T11:00:00.000Z",
  updatedAt: "2026-09-18T08:00:00.000Z",
};

describe("сиды", () => {
  const sequelize = getTestSequelize();
  const { Site, Equipment, EquipmentPassport, Technician, MaintenanceRequest } =
    getModels(sequelize);
  const RequestStatusHistory = getModels(sequelize).RequestStatusHistory;
  const RequestAssignee = getModels(sequelize).RequestAssignee;

  afterEach(async () => {
    await sequelize.query("DROP TABLE IF EXISTS sequelize_seeds");
  });

  test("наполняют базу данными для всех связей и отчётов, повторный запуск ничего не дублирует", async () => {
    const seeder = createSeeder({ sequelize });

    await seeder.up();
    await seeder.up();

    expect(await Site.count()).toBe(3);
    expect(await Equipment.count()).toBe(8);
    expect(await EquipmentPassport.count()).toBe(7);
    expect(await Technician.count()).toBe(6);
    expect(await MaintenanceRequest.count()).toBe(24);
    expect(await MaintenanceRequest.count({ where: { status: "done" } })).toBe(11);
    expect(await RequestAssignee.count({ where: { role: "lead" } })).toBe(17);
    expect(await RequestStatusHistory.count({ where: { newStatus: "done" } })).toBe(11);
    expect(await seeder.pending()).toHaveLength(0);

    await seeder.down({ to: 0 });
    expect(await MaintenanceRequest.count()).toBe(0);
    expect(await Site.count()).toBe(0);
    expect(await Technician.count({ paranoid: false })).toBe(0);
  });
});

describe("перенос данных из JSON-файлов Кейса 2", () => {
  const sequelize = getTestSequelize();
  const { Equipment, MaintenanceRequest, RequestStatusHistory } = getModels(sequelize);
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "maintenance-json-"));
    await writeFile(path.join(dir, "equipment.json"), JSON.stringify([LEGACY_EQUIPMENT]));
    await writeFile(path.join(dir, "requests.json"), JSON.stringify([LEGACY_REQUEST]));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  test("сохраняет идентификаторы и даты, пишет журнал, пропускает уже перенесённое", async () => {
    const dry = await importJson({ sequelize, dir, dryRun: true });
    expect(dry).toEqual({
      equipment: { total: 1, imported: 0 },
      requests: { total: 1, imported: 0 },
    });
    expect(await Equipment.count()).toBe(0);

    const first = await importJson({ sequelize, dir });
    expect(first.equipment.imported).toBe(1);
    expect(first.requests.imported).toBe(1);

    const equipment = await Equipment.findByPk(LEGACY_EQUIPMENT.id);
    expect(equipment.serialNumber).toBe("WT-LEGACY-001");
    expect(equipment.createdAt.toISOString()).toBe(LEGACY_EQUIPMENT.createdAt);
    const request = await MaintenanceRequest.findByPk(LEGACY_REQUEST.id);
    expect(request.status).toBe("in_progress");
    expect(request.plannedAt.toISOString()).toBe("2026-10-05T09:00:00.000Z");
    const history = await RequestStatusHistory.findAll({
      where: { requestId: LEGACY_REQUEST.id },
      order: [["id", "ASC"]],
    });
    expect(history.map((row) => [row.previousStatus, row.newStatus])).toEqual([
      [null, "new"],
      ["new", "in_progress"],
    ]);

    const second = await importJson({ sequelize, dir });
    expect(second.equipment.imported).toBe(0);
    expect(second.requests.imported).toBe(0);
    expect(await RequestStatusHistory.count()).toBe(2);
  });

  test("без файлов ничего не переносит", async () => {
    await rm(path.join(dir, "requests.json"));
    const summary = await importJson({ sequelize, dir: path.join(dir, "missing") });
    expect(summary).toEqual({
      equipment: { total: 0, imported: 0 },
      requests: { total: 0, imported: 0 },
    });
  });
});
