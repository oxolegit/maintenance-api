import { SequelizeRepository } from "./sequelizeRepository.js";
import { requestToItem } from "./serializers.js";
import { OPEN_REQUEST_STATUSES } from "../models/request.js";

// Карточка заявки отдаётся с оборудованием и бригадой одним запросом (JOIN, без N+1);
// при блокировке строки (FOR UPDATE) внешние соединения недопустимы — тогда без include
const CARD_INCLUDE = [
  { association: "equipment", attributes: ["id", "name", "serialNumber"] },
  {
    association: "assignees",
    include: [
      {
        association: "technician",
        attributes: ["id", "fullName", "specialization", "employeeNumber"],
        paranoid: false,
      },
    ],
  },
];

export class RequestRepository extends SequelizeRepository {
  constructor({ MaintenanceRequest }) {
    super({ model: MaintenanceRequest, toItem: requestToItem });
  }

  async findById(id, { transaction, lock } = {}) {
    const row = await this.model.findByPk(id, {
      include: lock ? [] : CARD_INCLUDE,
      // ведущий первым, далее по времени назначения
      order: lock
        ? []
        : [
            ["assignees", "role", "ASC"],
            ["assignees", "createdAt", "ASC"],
          ],
      transaction,
      lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
    });
    return row ? this.toItem(row) : null;
  }

  async create(data, options) {
    const created = await super.create(data, options);
    return this.findById(created.id, options);
  }

  async update(id, patch, options) {
    const updated = await super.update(id, patch, options);
    return updated && this.findById(id, options);
  }

  countOpenByEquipment(equipmentId, options) {
    return this.count({ equipmentId, status: { in: OPEN_REQUEST_STATUSES } }, options);
  }
}
