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
  q,
}) {
  const filters = {
    status,
    priority,
    equipmentId,
    createdAt: dateRange(createdFrom, createdTo),
    plannedAt: dateRange(plannedFrom, plannedTo),
  };
  if (q) {
    // подстрока без учёта регистра (ILIKE), по теме — через триграммный индекс
    filters.$or = [{ title: { contains: q } }, { description: { contains: q } }];
  }
  return filters;
}

export function createRequestService({
  requestRepository,
  equipmentRepository,
  assigneeRepository,
  historyRepository,
  transaction,
}) {
  async function getById(id, options) {
    const request = await requestRepository.findById(id, options);
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

  // Заявка и первая запись журнала (→ new) появляются в одной транзакции
  async function create(data) {
    const equipment = await getEquipment(data.equipmentId);
    if (equipment.status === "decommissioned") {
      throw new ConflictError("Нельзя создать заявку на списанное оборудование", {
        code: "EQUIPMENT_DECOMMISSIONED",
      });
    }
    return transaction(async (t) => {
      const request = await requestRepository.create(
        { ...data, status: "new" },
        { transaction: t },
      );
      await historyRepository.append(
        { requestId: request.id, previousStatus: null, newStatus: "new", author: request.author },
        { transaction: t },
      );
      return request;
    });
  }

  function assertTransition(request, status) {
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

    // Смена статуса — одна транзакция: строка заявки блокируется (FOR UPDATE), поэтому два
    // параллельных перехода выстраиваются в очередь и второй получает 409; обновление заявки
    // и запись в журнал либо применяются вместе, либо откатываются вместе
    changeStatus(id, { status, author = "system", comment = null }) {
      return transaction(async (t) => {
        const options = { transaction: t };
        const request = await getById(id, { ...options, lock: true });
        assertTransition(request, status);
        if (status === "in_progress") {
          const assigned = await assigneeRepository.countByRequest(id, options);
          if (assigned === 0) {
            throw new ConflictError("Нельзя взять заявку в работу без назначенных исполнителей", {
              code: "REQUEST_HAS_NO_ASSIGNEES",
            });
          }
        }
        const updated = await requestRepository.update(id, { status }, options);
        await historyRepository.append(
          { requestId: id, previousStatus: request.status, newStatus: status, author, comment },
          options,
        );
        return updated;
      });
    },

    async history(id) {
      await getById(id);
      return historyRepository.listByRequest(id);
    },

    async remove(id) {
      await getById(id);
      await requestRepository.remove(id);
    },
  };
}
