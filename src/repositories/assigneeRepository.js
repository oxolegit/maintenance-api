import { Op } from "sequelize";
import { assigneeToItem } from "./serializers.js";
import { OPEN_REQUEST_STATUSES } from "../models/request.js";

// Строки связи «заявка — специалист». Бригада заменяется целиком внутри транзакции сервиса:
// старые назначения удаляются, новые вставляются одним bulkCreate — дубль специалиста
// в составе упирается в составной ключ, отсутствующий специалист — во внешний ключ
export class AssigneeRepository {
  constructor({ RequestAssignee, Technician }) {
    this.model = RequestAssignee;
    this.technicianInclude = {
      association: "technician",
      model: Technician,
      attributes: ["id", "fullName", "specialization", "employeeNumber"],
      paranoid: false,
    };
  }

  async listByRequest(requestId, { transaction } = {}) {
    const rows = await this.model.findAll({
      where: { requestId },
      include: [this.technicianInclude],
      order: [
        ["role", "ASC"],
        ["createdAt", "ASC"],
      ],
      transaction,
    });
    return rows.map(assigneeToItem);
  }

  async replaceForRequest(requestId, assignees, { transaction } = {}) {
    await this.model.destroy({ where: { requestId }, transaction });
    await this.model.bulkCreate(
      assignees.map((item) => ({ ...item, requestId })),
      { transaction },
    );
    return this.listByRequest(requestId, { transaction });
  }

  async countByRequest(requestId, { role, transaction } = {}) {
    return this.model.count({ where: { requestId, ...(role && { role }) }, transaction });
  }

  async remove(requestId, technicianId, { transaction } = {}) {
    return (await this.model.destroy({ where: { requestId, technicianId }, transaction })) > 0;
  }

  // назначения специалиста на незакрытые заявки — препятствие для увольнения
  async countOpenByTechnician(technicianId, { transaction } = {}) {
    return this.model.count({
      where: { technicianId },
      include: [
        {
          association: "request",
          attributes: [],
          where: { status: { [Op.in]: OPEN_REQUEST_STATUSES } },
        },
      ],
      transaction,
    });
  }
}
