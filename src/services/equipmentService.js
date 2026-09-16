import { NotFoundError, ConflictError } from "../errors/index.js";

function buildFilters({ type, status, installedFrom, installedTo, q }) {
  const filters = { type, status };
  if (installedFrom || installedTo) {
    filters.installedAt = {
      gte: installedFrom,
      lte: installedTo && `${installedTo}T23:59:59.999Z`,
    };
  }
  if (q) {
    filters.$or = [{ name: { contains: q } }, { serialNumber: { contains: q } }];
  }
  return filters;
}

export function createEquipmentService({ equipmentRepository }) {
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
      return equipmentRepository.create(data);
    },

    async update(id, patch) {
      await getById(id);
      if (patch.serialNumber) {
        await assertSerialNumberFree(patch.serialNumber, id);
      }
      return equipmentRepository.update(id, patch);
    },

    async remove(id) {
      await getById(id);
      await equipmentRepository.remove(id);
    },
  };
}
