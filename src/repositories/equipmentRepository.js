import { SequelizeRepository } from "./sequelizeRepository.js";
import { equipmentToRow, equipmentToItem } from "./serializers.js";

export class EquipmentRepository extends SequelizeRepository {
  constructor({ Equipment }) {
    super({ model: Equipment, toRow: equipmentToRow, toItem: equipmentToItem });
  }

  findBySerialNumber(serialNumber, options) {
    return this.findOne({ serialNumber }, options);
  }
}
