import { SequelizeRepository } from "./sequelizeRepository.js";
import { technicianToItem } from "./serializers.js";

// Модель paranoid: remove() проставляет deleted_at, остальные методы уволенных не видят
export class TechnicianRepository extends SequelizeRepository {
  constructor({ Technician }) {
    super({ model: Technician, toItem: technicianToItem });
  }

  async countExisting(ids, options) {
    return this.count({ id: { in: ids } }, options);
  }
}
