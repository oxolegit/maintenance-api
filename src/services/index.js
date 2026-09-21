import { createEquipmentService } from "./equipmentService.js";

export function createServices({ repositories }) {
  return {
    equipmentService: createEquipmentService(repositories),
  };
}
