import { SequelizeRepository } from "./sequelizeRepository.js";
import { requestToItem } from "./serializers.js";
import { OPEN_REQUEST_STATUSES } from "../models/request.js";

export class RequestRepository extends SequelizeRepository {
  constructor({ MaintenanceRequest }) {
    super({ model: MaintenanceRequest, toItem: requestToItem });
  }

  countOpenByEquipment(equipmentId, options) {
    return this.count({ equipmentId, status: { in: OPEN_REQUEST_STATUSES } }, options);
  }
}
