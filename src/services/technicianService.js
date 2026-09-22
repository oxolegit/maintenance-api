import { NotFoundError, ConflictError } from "../errors/index.js";

function buildFilters({ specialization, q }) {
  const filters = { specialization: specialization ? { contains: specialization } : undefined };
  if (q) {
    filters.$or = [{ fullName: { contains: q } }, { employeeNumber: { contains: q } }];
  }
  return filters;
}

export function createTechnicianService({ technicianRepository, assigneeRepository }) {
  async function getById(id) {
    const technician = await technicianRepository.findById(id);
    if (!technician) {
      throw new NotFoundError(`Специалист ${id} не найден`, { code: "TECHNICIAN_NOT_FOUND" });
    }
    return technician;
  }

  return {
    async list({ page, limit, sort, order, ...filterParams }) {
      const { items, total } = await technicianRepository.list({
        filters: buildFilters(filterParams),
        sort,
        order,
        page,
        limit,
      });
      return { items, total, page, limit };
    },

    getById,

    create(data) {
      return technicianRepository.create(data);
    },

    async update(id, patch) {
      await getById(id);
      return technicianRepository.update(id, patch);
    },

    // мягкое удаление: специалист исчезает из списков и новых назначений, но остаётся
    // в истории закрытых заявок; с незакрытыми заявками сначала нужно снять назначения
    async remove(id) {
      await getById(id);
      const openAssignments = await assigneeRepository.countOpenByTechnician(id);
      if (openAssignments > 0) {
        throw new ConflictError(
          `Нельзя удалить специалиста: он назначен на незакрытые заявки (${openAssignments})`,
          { code: "TECHNICIAN_ASSIGNED" },
        );
      }
      await technicianRepository.remove(id);
    },
  };
}
