import { createEquipmentService } from "./equipmentService.js";
import { createRequestService } from "./requestService.js";

export function createServices({ repositories }) {
  return {
    equipmentService: createEquipmentService(repositories),
    requestService: createRequestService(repositories),
  };
}
