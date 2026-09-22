import { getModels } from "../db/models/index.js";
import { EquipmentRepository } from "./equipmentRepository.js";
import { RequestRepository } from "./requestRepository.js";

// Единственное место, где сервисы соприкасаются с ORM: репозитории и функция transaction,
// выполняющая работу в одной транзакции с откатом при исключении
export function createRepositories({ sequelize }) {
  const models = getModels(sequelize);
  return {
    equipmentRepository: new EquipmentRepository(models),
    requestRepository: new RequestRepository(models),
    transaction: (work) => sequelize.transaction(work),
  };
}
