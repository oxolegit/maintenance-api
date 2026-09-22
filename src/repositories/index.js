import { getModels } from "../db/models/index.js";
import { SiteRepository } from "./siteRepository.js";
import { EquipmentRepository } from "./equipmentRepository.js";
import { PassportRepository } from "./passportRepository.js";
import { RequestRepository } from "./requestRepository.js";
import { TechnicianRepository } from "./technicianRepository.js";
import { AssigneeRepository } from "./assigneeRepository.js";
import { HistoryRepository } from "./historyRepository.js";

// Единственное место, где сервисы соприкасаются с ORM: репозитории и функция transaction,
// выполняющая работу в одной транзакции с откатом при исключении
export function createRepositories({ sequelize }) {
  const models = getModels(sequelize);
  return {
    siteRepository: new SiteRepository(models),
    equipmentRepository: new EquipmentRepository(models),
    passportRepository: new PassportRepository(models),
    requestRepository: new RequestRepository(models),
    technicianRepository: new TechnicianRepository(models),
    assigneeRepository: new AssigneeRepository(models),
    historyRepository: new HistoryRepository(models),
    transaction: (work) => sequelize.transaction(work),
  };
}
