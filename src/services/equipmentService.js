import { NotFoundError, ConflictError } from "../errors/index.js";
import { dateRange } from "./filters.js";

function buildFilters({ siteId, type, status, installedFrom, installedTo, q }) {
  const filters = { siteId, type, status, installedAt: dateRange(installedFrom, installedTo) };
  if (q) {
    filters.$or = [{ name: { contains: q } }, { serialNumber: { contains: q } }];
  }
  return filters;
}

export function createEquipmentService({
  equipmentRepository,
  requestRepository,
  siteRepository,
  weatherService,
}) {
  async function getById(id) {
    const equipment = await equipmentRepository.findById(id);
    if (!equipment) {
      throw new NotFoundError(`Оборудование ${id} не найдено`);
    }
    return equipment;
  }

  async function assertSerialNumberFree(serialNumber, exceptId) {
    const existing = await equipmentRepository.findBySerialNumber(serialNumber);
    if (existing && existing.id !== exceptId) {
      throw new ConflictError(`Серийный номер ${serialNumber} уже занят`, {
        code: "SERIAL_NUMBER_TAKEN",
        details: [{ field: "serialNumber", message: "Серийный номер уже занят" }],
      });
    }
  }

  async function assertSiteExists(siteId) {
    if (siteId && !(await siteRepository.findById(siteId))) {
      throw new NotFoundError(`Площадка ${siteId} не найдена`, { code: "SITE_NOT_FOUND" });
    }
  }

  return {
    async list({ page, limit, sort, order, ...filterParams }) {
      const { items, total } = await equipmentRepository.list({
        filters: buildFilters(filterParams),
        sort,
        order,
        page,
        limit,
      });
      return { items, total, page, limit };
    },

    getById,

    async create(data) {
      await assertSerialNumberFree(data.serialNumber);
      await assertSiteExists(data.siteId);
      return equipmentRepository.create(data);
    },

    async update(id, patch) {
      await getById(id);
      if (patch.serialNumber) {
        await assertSerialNumberFree(patch.serialNumber, id);
      }
      await assertSiteExists(patch.siteId);
      return equipmentRepository.update(id, patch);
    },

    async getWeather(id, { days } = {}) {
      const equipment = await getById(id);
      const forecast = await weatherService.getForecast(equipment.location, days);
      return { equipmentId: equipment.id, equipmentName: equipment.name, ...forecast };
    },

    async remove(id) {
      await getById(id);
      const openRequests = await requestRepository.countOpenByEquipment(id);
      if (openRequests > 0) {
        throw new ConflictError(
          `Нельзя удалить оборудование: по нему есть незакрытые заявки (${openRequests})`,
          { code: "EQUIPMENT_HAS_OPEN_REQUESTS" },
        );
      }
      await equipmentRepository.remove(id);
    },
  };
}
