import { SequelizeRepository } from "./sequelizeRepository.js";
import { equipmentToRow, equipmentToItem } from "./serializers.js";

// Карточка оборудования отдаётся вместе с площадкой и паспортом (два LEFT JOIN, один запрос);
// в списках вложенных объектов нет — там достаточно siteId
const CARD_INCLUDE = ["site", "passport"];

export class EquipmentRepository extends SequelizeRepository {
  constructor({ Equipment }) {
    super({ model: Equipment, toRow: equipmentToRow, toItem: equipmentToItem });
  }

  async findById(id, { transaction, lock } = {}) {
    const row = await this.model.findByPk(id, {
      include: lock ? [] : CARD_INCLUDE,
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

  findBySerialNumber(serialNumber, options) {
    return this.findOne({ serialNumber }, options);
  }
}
