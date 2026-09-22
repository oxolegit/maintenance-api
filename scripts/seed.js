import { existsSync } from "node:fs";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import { createSequelize } from "../src/db/sequelize.js";
import { createRepositories } from "../src/repositories/index.js";
import { createServices } from "../src/services/index.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const config = loadConfig(process.env);
const logger = createLogger(config);
const sequelize = createSequelize({ db: config.db, logger });
const repositories = createRepositories({ sequelize });
const { equipmentService, requestService } = createServices({
  repositories,
  weatherClient: null,
  config,
  logger,
});

const equipment = [
  {
    name: "Ветротурбина ВТ-01",
    type: "turbine",
    serialNumber: "WT-2024-001",
    location: { lat: 44.9521, lon: 34.1024 },
    installedAt: "2024-05-10",
  },
  {
    name: "Ветротурбина ВТ-02",
    type: "turbine",
    serialNumber: "WT-2024-002",
    location: { lat: 44.9587, lon: 34.1101 },
    status: "maintenance",
    installedAt: "2024-05-12",
  },
  {
    name: "Инвертор И-07",
    type: "inverter",
    serialNumber: "INV-2023-007",
    location: { lat: 44.9533, lon: 34.1077 },
    installedAt: "2023-11-01",
  },
  {
    name: "Датчик ветра Д-3",
    type: "sensor",
    serialNumber: "SNS-2022-003",
    location: { lat: 44.9502, lon: 34.0998 },
    status: "fault",
    installedAt: "2022-08-20",
  },
  {
    name: "Подстанция ПС-1",
    type: "substation",
    serialNumber: "SUB-2021-001",
    location: { lat: 44.949, lon: 34.115 },
    installedAt: "2021-03-15",
  },
];

const requests = [
  ["WT-2024-001", "Замена подшипника главного вала", "high", "2026-10-05T09:00:00Z"],
  ["WT-2024-001", "Плановый осмотр гондолы", "low", null],
  ["WT-2024-002", "Балансировка ротора", "critical", "2026-09-28T07:00:00Z"],
  ["INV-2023-007", "Проверка изоляции силовых кабелей", "medium", null],
  ["SNS-2022-003", "Замена анемометра", "high", "2026-09-25T10:00:00Z"],
  ["SUB-2021-001", "Осмотр трансформатора после грозы", "medium", "2026-10-12T08:00:00Z"],
];

let createdEquipment = 0;
let createdRequests = 0;

for (const item of equipment) {
  if (await repositories.equipmentRepository.findBySerialNumber(item.serialNumber)) {
    continue;
  }
  await equipmentService.create({ status: "operational", ...item });
  createdEquipment += 1;
}

for (const [serialNumber, title, priority, plannedAt] of requests) {
  const owner = await repositories.equipmentRepository.findBySerialNumber(serialNumber);
  const exists = await repositories.requestRepository.findOne({ equipmentId: owner.id, title });
  if (exists) {
    continue;
  }
  await requestService.create({
    equipmentId: owner.id,
    title,
    description: "",
    priority,
    plannedAt,
  });
  createdRequests += 1;
}

logger.info({ createdEquipment, createdRequests }, "демо-данные загружены");
await sequelize.close();
