import { createTestSequelize } from "./helpers/db.js";
import { createMigrator } from "../src/db/migrator.js";

const TABLES = [
  "sites",
  "equipment",
  "equipment_passports",
  "maintenance_requests",
  "request_status_history",
  "technicians",
  "request_assignees",
  "parts",
  "request_parts",
];

const EQUIPMENT_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const TECH_1 = "33333333-3333-4333-8333-333333333333";
const TECH_2 = "44444444-4444-4444-8444-444444444444";

async function select(sequelize, sql, bind = []) {
  return sequelize.query(sql, { type: "SELECT", bind });
}

// Sequelize оборачивает ошибки уникальности своим сообщением, имя ограничения лежит в parent
async function expectConstraint(promise, constraint) {
  await expect(promise.catch((error) => Promise.reject(error.parent ?? error))).rejects.toThrow(
    constraint,
  );
}

async function publicTables(sequelize) {
  const rows = await select(
    sequelize,
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'sequelize_meta'",
  );
  return rows.map((row) => row.tablename).sort();
}

async function enumTypes(sequelize) {
  const rows = await select(sequelize, "SELECT typname FROM pg_type WHERE typtype = 'e'");
  return rows.map((row) => row.typname).sort();
}

async function insertRequestWithEquipment(sequelize, serial) {
  await sequelize.query(
    `INSERT INTO equipment (id, name, type, serial_number, latitude, longitude, installed_at)
     VALUES ($1, 'Турбина', 'turbine', $2, 44.95, 34.10, '2024-01-01')`,
    { bind: [EQUIPMENT_ID, serial] },
  );
  await sequelize.query(
    "INSERT INTO maintenance_requests (id, equipment_id, title) VALUES ($1, $2, 'Осмотр')",
    { bind: [REQUEST_ID, EQUIPMENT_ID] },
  );
}

describe("миграции", () => {
  let sequelize;
  let migrator;

  beforeAll(async () => {
    sequelize = createTestSequelize();
    migrator = createMigrator({ sequelize });
    await migrator.up();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("создают все таблицы и именованные перечисления", async () => {
    expect(await publicTables(sequelize)).toEqual([...TABLES].sort());
    expect(await enumTypes(sequelize)).toEqual([
      "assignee_role",
      "equipment_status",
      "equipment_type",
      "request_priority",
      "request_status",
    ]);
  });

  test("полный откат убирает таблицы, типы и функции, повторное применение проходит", async () => {
    await migrator.down({ to: 0 });

    expect(await publicTables(sequelize)).toEqual([]);
    expect(await enumTypes(sequelize)).toEqual([]);
    const [functions] = await select(
      sequelize,
      "SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'request_status_history_immutable'",
    );
    expect(functions.n).toBe(0);

    await migrator.up();
    expect(await migrator.pending()).toHaveLength(0);
    expect(await migrator.executed()).toHaveLength(10);
  });

  test("журнал статусов не редактируется напрямую, но удаляется каскадом вместе с заявкой", async () => {
    await insertRequestWithEquipment(sequelize, "T-1");
    await sequelize.query(
      "INSERT INTO request_status_history (request_id, new_status, author) VALUES ($1, 'new', 'test')",
      { bind: [REQUEST_ID] },
    );

    await expect(sequelize.query("DELETE FROM request_status_history")).rejects.toThrow(
      /не редактируется/,
    );
    await expect(
      sequelize.query("UPDATE request_status_history SET comment = 'x'"),
    ).rejects.toThrow(/не редактируется/);

    await sequelize.query("DELETE FROM maintenance_requests WHERE id = $1", { bind: [REQUEST_ID] });
    const [left] = await select(sequelize, "SELECT count(*)::int AS n FROM request_status_history");
    expect(left.n).toBe(0);

    await sequelize.query("DELETE FROM equipment WHERE id = $1", { bind: [EQUIPMENT_ID] });
  });

  test("в бригаде не может быть двух ведущих и одного специалиста дважды", async () => {
    await insertRequestWithEquipment(sequelize, "T-2");
    await sequelize.query(
      `INSERT INTO technicians (id, full_name, specialization, employee_number)
       VALUES ($1, 'Иванов И. И.', 'механик', 'E-1'), ($2, 'Петров П. П.', 'электрик', 'E-2')`,
      { bind: [TECH_1, TECH_2] },
    );
    const assign = (technicianId, role) =>
      sequelize.query(
        "INSERT INTO request_assignees (request_id, technician_id, role, hours) VALUES ($1, $2, $3, 2)",
        { bind: [REQUEST_ID, technicianId, role] },
      );

    await assign(TECH_1, "lead");

    await expectConstraint(assign(TECH_2, "lead"), "request_assignees_single_lead");
    await expectConstraint(assign(TECH_1, "member"), "request_assignees_pkey");
    await expectConstraint(
      sequelize.query("DELETE FROM technicians WHERE id = $1", { bind: [TECH_1] }),
      "request_assignees_technician_id_fkey",
    );

    await sequelize.query("DELETE FROM equipment WHERE id = $1", { bind: [EQUIPMENT_ID] });
    await sequelize.query("DELETE FROM technicians");
  });
});
