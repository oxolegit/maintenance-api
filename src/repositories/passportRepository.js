import { SequelizeRepository } from "./sequelizeRepository.js";
import { passportToRow, passportToItem } from "./serializers.js";

export class PassportRepository extends SequelizeRepository {
  constructor({ EquipmentPassport }) {
    super({ model: EquipmentPassport, toRow: passportToRow, toItem: passportToItem });
  }

  findByEquipment(equipmentId, options) {
    return this.findOne({ equipmentId }, options);
  }

  // Паспорт один на единицу оборудования: существующий заменяется целиком, иначе создаётся.
  // Гонка двух одновременных PUT упрётся в UNIQUE (equipment_id) и станет ответом 409
  async upsertForEquipment(equipmentId, data, options) {
    const existing = await this.findByEquipment(equipmentId, options);
    if (existing) {
      return { passport: await this.update(existing.id, data, options), created: false };
    }
    return { passport: await this.create({ ...data, equipmentId }, options), created: true };
  }

  async removeByEquipment(equipmentId, { transaction } = {}) {
    return (await this.model.destroy({ where: { equipmentId }, transaction })) > 0;
  }
}
