import { defineSite } from "./site.js";
import { defineEquipment } from "./equipment.js";
import { defineEquipmentPassport } from "./equipmentPassport.js";
import { defineMaintenanceRequest } from "./maintenanceRequest.js";
import { defineRequestStatusHistory } from "./requestStatusHistory.js";
import { defineTechnician } from "./technician.js";
import { defineRequestAssignee } from "./requestAssignee.js";

// Модели повторяют схему из migrations/: имена колонок в snake_case даёт define.underscored,
// ограничения (NOT NULL, UNIQUE, внешние ключи) живут в БД, здесь — их отражение для include
export function defineModels(sequelize) {
  const Site = defineSite(sequelize);
  const Equipment = defineEquipment(sequelize);
  const EquipmentPassport = defineEquipmentPassport(sequelize);
  const MaintenanceRequest = defineMaintenanceRequest(sequelize);
  const RequestStatusHistory = defineRequestStatusHistory(sequelize);
  const Technician = defineTechnician(sequelize);
  const RequestAssignee = defineRequestAssignee(sequelize);

  Site.hasMany(Equipment, { as: "equipment", foreignKey: "siteId", onDelete: "RESTRICT" });
  Equipment.belongsTo(Site, { as: "site", foreignKey: "siteId" });

  Equipment.hasOne(EquipmentPassport, {
    as: "passport",
    foreignKey: "equipmentId",
    onDelete: "CASCADE",
  });
  EquipmentPassport.belongsTo(Equipment, { as: "equipment", foreignKey: "equipmentId" });

  Equipment.hasMany(MaintenanceRequest, {
    as: "requests",
    foreignKey: "equipmentId",
    onDelete: "CASCADE",
  });
  MaintenanceRequest.belongsTo(Equipment, { as: "equipment", foreignKey: "equipmentId" });

  MaintenanceRequest.hasMany(RequestStatusHistory, {
    as: "history",
    foreignKey: "requestId",
    onDelete: "CASCADE",
  });
  RequestStatusHistory.belongsTo(MaintenanceRequest, { as: "request", foreignKey: "requestId" });

  // N:M через модель связи с собственными полями role и hours
  MaintenanceRequest.belongsToMany(Technician, {
    as: "technicians",
    through: RequestAssignee,
    foreignKey: "requestId",
    otherKey: "technicianId",
  });
  Technician.belongsToMany(MaintenanceRequest, {
    as: "requests",
    through: RequestAssignee,
    foreignKey: "technicianId",
    otherKey: "requestId",
  });
  // прямой доступ к строкам связи — для выдачи бригады с ролями одним запросом
  MaintenanceRequest.hasMany(RequestAssignee, {
    as: "assignees",
    foreignKey: "requestId",
    onDelete: "CASCADE",
  });
  RequestAssignee.belongsTo(MaintenanceRequest, { as: "request", foreignKey: "requestId" });
  RequestAssignee.belongsTo(Technician, { as: "technician", foreignKey: "technicianId" });
  Technician.hasMany(RequestAssignee, { as: "assignments", foreignKey: "technicianId" });

  return {
    Site,
    Equipment,
    EquipmentPassport,
    MaintenanceRequest,
    RequestStatusHistory,
    Technician,
    RequestAssignee,
  };
}

const modelsByConnection = new WeakMap();

// Модели определяются один раз на соединение: повторный define перезаписал бы их
export function getModels(sequelize) {
  if (!modelsByConnection.has(sequelize)) {
    modelsByConnection.set(sequelize, defineModels(sequelize));
  }
  return modelsByConnection.get(sequelize);
}
