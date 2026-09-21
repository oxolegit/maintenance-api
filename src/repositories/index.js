import { createMemoryStorage } from "./storage/memoryStorage.js";
import { createFileStorage } from "./storage/fileStorage.js";
import { EquipmentRepository } from "./equipmentRepository.js";
import { RequestRepository } from "./requestRepository.js";

export function createStorage({ driver, dataDir }) {
  return driver === "file" ? createFileStorage({ dataDir }) : createMemoryStorage();
}

export async function createRepositories({ storage }) {
  return {
    equipmentRepository: await new EquipmentRepository({ storage }).init(),
    requestRepository: await new RequestRepository({ storage }).init(),
  };
}
