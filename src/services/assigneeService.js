import { NotFoundError, ConflictError, ValidationError } from "../errors/index.js";
import { OPEN_REQUEST_STATUSES } from "../models/request.js";

const isClosed = (status) => !OPEN_REQUEST_STATUSES.includes(status);

export function createAssigneeService({
  requestRepository,
  technicianRepository,
  assigneeRepository,
  transaction,
}) {
  // заявка блокируется на время операции (SELECT ... FOR UPDATE): параллельные назначения
  // и смена статуса выстраиваются в очередь и видят согласованное состояние
  async function lockRequest(id, options) {
    const request = await requestRepository.findById(id, { ...options, lock: true });
    if (!request) {
      throw new NotFoundError(`Заявка ${id} не найдена`);
    }
    return request;
  }

  async function assertTechniciansActive(assignees, options) {
    const ids = [...new Set(assignees.map((item) => item.technicianId))];
    const existing = await technicianRepository.countExisting(ids, options);
    if (existing !== ids.length) {
      throw new NotFoundError("Один из специалистов не найден или уволен", {
        code: "TECHNICIAN_NOT_FOUND",
        details: [{ field: "assignees", message: "Специалист не найден" }],
      });
    }
  }

  return {
    async list(requestId) {
      if (!(await requestRepository.findById(requestId))) {
        throw new NotFoundError(`Заявка ${requestId} не найдена`);
      }
      return assigneeRepository.listByRequest(requestId);
    },

    // Одна транзакция: снять прежний состав, вставить новый, проверить правило «ровно один
    // ведущий». Любая ошибка (нет специалиста, дубль в составе, второй lead, нарушение
    // правила) откатывает всё — прежняя бригада остаётся на месте
    assign(requestId, assignees) {
      return transaction(async (t) => {
        const options = { transaction: t };
        const request = await lockRequest(requestId, options);
        if (isClosed(request.status)) {
          throw new ConflictError(`Заявка в статусе ${request.status} закрыта для назначений`, {
            code: "REQUEST_CLOSED",
          });
        }

        const brigade = await assigneeRepository.replaceForRequest(requestId, assignees, options);
        await assertTechniciansActive(assignees, options);

        const leads = brigade.filter((item) => item.role === "lead").length;
        if (leads !== 1) {
          throw new ValidationError([
            {
              field: "assignees",
              message: `В бригаде должен быть ровно один ведущий (lead), передано: ${leads}`,
            },
          ]);
        }
        return brigade;
      });
    },

    remove(requestId, technicianId) {
      return transaction(async (t) => {
        const options = { transaction: t };
        const request = await lockRequest(requestId, options);
        const assigned = await assigneeRepository.countByRequest(requestId, options);
        if (request.status === "in_progress" && assigned <= 1) {
          throw new ConflictError("У заявки в работе должен остаться хотя бы один исполнитель", {
            code: "REQUEST_HAS_NO_ASSIGNEES",
          });
        }
        if (!(await assigneeRepository.remove(requestId, technicianId, options))) {
          throw new NotFoundError(`Специалист ${technicianId} не назначен на заявку`, {
            code: "ASSIGNEE_NOT_FOUND",
          });
        }
      });
    },
  };
}
