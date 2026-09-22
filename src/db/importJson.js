import { readFile } from "node:fs/promises";
import path from "node:path";
import { getModels } from "./models/index.js";

// Перенос данных из файлового хранилища Кейса 2 (data/equipment.json, data/requests.json).
// Идентификаторы и метки времени сохраняются, уже существующие записи пропускаются,
// у каждой перенесённой заявки появляется журнал: создание и, если статус менялся, переход

async function readCollection(dir, name) {
  try {
    return JSON.parse(await readFile(path.join(dir, `${name}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

const day = (value) => String(value).slice(0, 10);

function historyRows(request) {
  const rows = [
    {
      requestId: request.id,
      previousStatus: null,
      newStatus: "new",
      author: "import",
      changedAt: request.createdAt,
    },
  ];
  if (request.status !== "new") {
    rows.push({
      requestId: request.id,
      previousStatus: "new",
      newStatus: request.status,
      author: "import",
      changedAt: request.updatedAt,
      comment: "статус перенесён из файлового хранилища",
    });
  }
  return rows;
}

export async function importJson({ sequelize, dir = "data", dryRun = false }) {
  const { Equipment, MaintenanceRequest, RequestStatusHistory } = getModels(sequelize);
  const equipment = await readCollection(dir, "equipment");
  const requests = await readCollection(dir, "requests");

  const summary = {
    equipment: { total: equipment.length, imported: 0 },
    requests: { total: requests.length, imported: 0 },
  };
  if (dryRun) {
    return summary;
  }

  await sequelize.transaction(async (transaction) => {
    const existingEquipment = new Set(
      (await Equipment.findAll({ attributes: ["id"], transaction })).map((row) => row.id),
    );
    const newEquipment = equipment.filter((item) => !existingEquipment.has(item.id));
    await Equipment.bulkCreate(
      newEquipment.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        serialNumber: item.serialNumber,
        status: item.status,
        latitude: item.location.lat,
        longitude: item.location.lon,
        installedAt: day(item.installedAt),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      { transaction },
    );
    summary.equipment.imported = newEquipment.length;

    const existingRequests = new Set(
      (await MaintenanceRequest.findAll({ attributes: ["id"], transaction })).map((row) => row.id),
    );
    const newRequests = requests.filter((item) => !existingRequests.has(item.id));
    await MaintenanceRequest.bulkCreate(
      newRequests.map((item) => ({
        id: item.id,
        equipmentId: item.equipmentId,
        title: item.title,
        description: item.description ?? "",
        priority: item.priority,
        status: item.status,
        plannedAt: item.plannedAt,
        author: "import",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      { transaction },
    );
    await RequestStatusHistory.bulkCreate(newRequests.flatMap(historyRows), { transaction });
    summary.requests.imported = newRequests.length;
  });

  return summary;
}
