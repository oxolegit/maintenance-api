import { DataTypes } from "sequelize";
import { REQUEST_STATUSES } from "../../models/request.js";
import { bigint } from "./common.js";

// Журнал только пополняется: у модели нет updatedAt, а UPDATE и DELETE отклоняет триггер в БД
export function defineRequestStatusHistory(sequelize) {
  return sequelize.define(
    "RequestStatusHistory",
    {
      id: bigint("id", { primaryKey: true, autoIncrement: true }),
      requestId: { type: DataTypes.UUID, allowNull: false },
      previousStatus: { type: DataTypes.ENUM(...REQUEST_STATUSES), allowNull: true },
      newStatus: { type: DataTypes.ENUM(...REQUEST_STATUSES), allowNull: false },
      author: { type: DataTypes.STRING(100), allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: true },
      changedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "request_status_history", timestamps: false },
  );
}
