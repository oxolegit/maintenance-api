import { DataTypes } from "sequelize";
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from "../../models/request.js";
import { uuidId } from "./common.js";

export function defineMaintenanceRequest(sequelize) {
  return sequelize.define(
    "MaintenanceRequest",
    {
      id: uuidId(),
      equipmentId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      priority: {
        type: DataTypes.ENUM(...REQUEST_PRIORITIES),
        allowNull: false,
        defaultValue: "medium",
      },
      status: { type: DataTypes.ENUM(...REQUEST_STATUSES), allowNull: false, defaultValue: "new" },
      plannedAt: { type: DataTypes.DATE, allowNull: true },
      author: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "system" },
    },
    { tableName: "maintenance_requests" },
  );
}
