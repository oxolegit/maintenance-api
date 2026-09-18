import { AppError, NotFoundError, ConflictError, ValidationError } from "../errors/index.js";
import { validateRequestItem } from "../validators/requests.js";
import { dateRange } from "./filters.js";

export const STATUS_TRANSITIONS = {
  new: ["in_progress", "rejected"],
  in_progress: ["done", "rejected"],
  done: [],
  rejected: [],
};

export function canTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

function buildFilters({
  status,
  priority,
  equipmentId,
  createdFrom,
  createdTo,
  plannedFrom,
  plannedTo,
}) {
  return {
    status,
    priority,
    equipmentId,
    createdAt: dateRange(createdFrom, createdTo),
    plannedAt: dateRange(plannedFrom, plannedTo),
  };
}

export function createRequestService({ requestRepository, equipmentRepository }) {
  async function getById(id) {
    const request = await requestRepository.findById(id);
    if (!request) {
      throw new NotFoundError(`Заявка ${id} не найдена`);
    }
    return request;
  }

  async function getEquipment(equipmentId) {
    const equipment = await equipmentRepository.findById(equipmentId);
    if (!equipment) {
      throw new NotFoundError(`Оборудование ${equipmentId} не найдено`, {
        code: "EQUIPMENT_NOT_FOUND",
      });
    }
    return equipment;
  }

  async function list({ page, limit, sort, order, ...filterParams }) {
    const { items, total } = await requestRepository.list({
      filters: buildFilters(filterParams),
      sort,
      order,
      page,
      limit,
    });
    return { items, total, page, limit };
  }

  async function create(data) {
    const equipment = await getEquipment(data.equipmentId);
    if (equipment.status === "decommissioned") {
      throw new ConflictError("Нельзя создать заявку на списанное оборудование", {
        code: "EQUIPMENT_DECOMMISSIONED",
      });
    }
    return requestRepository.create({ ...data, status: "new" });
  }

  async function importOne(item, index) {
    try {
      const { data, details } = validateRequestItem(item);
      if (details) {
        throw new ValidationError(details);
      }
      const created = await create(data);
      return { index, status: 201, data: created };
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }
      return {
        index,
        status: error.status,
        error: { code: error.code, message: error.message, details: error.details },
      };
    }
  }

  return {
    list,

    async listByEquipment(equipmentId, query) {
      await getEquipment(equipmentId);
      return list({ ...query, equipmentId });
    },

    getById,

    create,

    async importMany(items) {
      const results = [];
      for (const [index, item] of items.entries()) {
        results.push(await importOne(item, index));
      }
      const created = results.filter((result) => result.status === 201).length;
      return {
        summary: { total: results.length, created, failed: results.length - created },
        results,
      };
    },

    async update(id, patch) {
      await getById(id);
      return requestRepository.update(id, patch);
    },

    async changeStatus(id, status) {
      const request = await getById(id);
      if (!canTransition(request.status, status)) {
        const allowed = STATUS_TRANSITIONS[request.status].join(", ") || "нет";
        throw new ConflictError(`Переход из статуса ${request.status} в ${status} недопустим`, {
          code: "INVALID_STATUS_TRANSITION",
          details: [
            {
              field: "status",
              message: `Из статуса ${request.status} допустимы переходы: ${allowed}`,
            },
          ],
        });
      }
      return requestRepository.update(id, { status });
    },

    async remove(id) {
      await getById(id);
      await requestRepository.remove(id);
    },
  };
}
