import { CollectionRepository } from "./collectionRepository.js";

export class EquipmentRepository extends CollectionRepository {
  constructor({ storage }) {
    super({ collection: "equipment", storage });
  }

  findBySerialNumber(serialNumber) {
    return this.findOne({ serialNumber });
  }
}
