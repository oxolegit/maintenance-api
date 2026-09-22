import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import { createSequelize } from "../src/db/sequelize.js";
import { getModels } from "../src/db/models/index.js";

// Синтетическая нагрузка для проверки индексов (EXPLAIN ANALYZE), не сид:
// node scripts/generate-load.js [--equipment 200] [--requests 50000]
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
process.env.TZ ??= "UTC";

const { values } = parseArgs({
  options: {
    equipment: { type: "string", default: "200" },
    requests: { type: "string", default: "50000" },
  },
});
const equipmentCount = Number(values.equipment);
const requestCount = Number(values.requests);

const TYPES = ["turbine", "inverter", "sensor", "substation"];
const STATUSES = ["new", "in_progress", "done", "rejected"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const TITLES = [
  "Плановый осмотр",
  "Замена подшипника",
  "Диагностика генератора",
  "Смазка редуктора",
  "Проверка изоляции",
  "Балансировка ротора",
  "Замена датчика",
  "Тепловизионный контроль",
];
const pick = (list, i) => list[i % list.length];
const day = (offset) => new Date(Date.UTC(2026, 0, 1) + offset * 86400000);

const config = loadConfig(process.env);
const logger = createLogger(config);
const sequelize = createSequelize({ db: config.db, logger });
const { Equipment, MaintenanceRequest, RequestStatusHistory } = getModels(sequelize);

try {
  const equipment = Array.from({ length: equipmentCount }, (_, i) => ({
    id: randomUUID(),
    name: `${pick(["Турбина", "Инвертор", "Датчик", "Подстанция"], i)} Н-${i + 1}`,
    type: pick(TYPES, i),
    serialNumber: `LOAD-${String(i + 1).padStart(6, "0")}`,
    status: "operational",
    latitude: 45 + (i % 100) / 1000,
    longitude: 34 + (i % 100) / 1000,
    installedAt: day(i % 365)
      .toISOString()
      .slice(0, 10),
  }));
  await Equipment.bulkCreate(equipment);

  const batch = 5000;
  for (let start = 0; start < requestCount; start += batch) {
    const rows = Array.from({ length: Math.min(batch, requestCount - start) }, (_, k) => {
      const i = start + k;
      const createdAt = day(i % 260);
      return {
        id: randomUUID(),
        equipmentId: equipment[i % equipmentCount].id,
        title: `${pick(TITLES, i)} №${i + 1}`,
        priority: pick(PRIORITIES, i),
        status: pick(STATUSES, i),
        plannedAt: i % 3 === 0 ? null : day((i % 260) + 7),
        author: "load",
        createdAt,
        updatedAt: createdAt,
      };
    });
    await MaintenanceRequest.bulkCreate(rows);
    await RequestStatusHistory.bulkCreate(
      rows.flatMap((row) => [
        {
          requestId: row.id,
          previousStatus: null,
          newStatus: "new",
          author: "load",
          changedAt: row.createdAt,
        },
        ...(row.status === "new"
          ? []
          : [
              {
                requestId: row.id,
                previousStatus: "new",
                newStatus: row.status,
                author: "load",
                changedAt: new Date(row.createdAt.getTime() + 3 * 86400000),
              },
            ]),
      ]),
    );
  }
  logger.info({ equipment: equipmentCount, requests: requestCount }, "нагрузочные данные созданы");
} finally {
  await sequelize.close();
}
