import { CollectionRepository } from "./collectionRepository.js";
import { OPEN_REQUEST_STATUSES } from "../models/request.js";

export class RequestRepository extends CollectionRepository {
  constructor({ storage }) {
    super({ collection: "requests", storage });
  }

  countOpenByEquipment(equipmentId) {
    return this.count({ equipmentId, status: { in: OPEN_REQUEST_STATUSES } });
  }
}
