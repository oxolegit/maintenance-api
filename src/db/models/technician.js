import { DataTypes } from "sequelize";
import { uuidId } from "./common.js";

// paranoid: destroy() проставляет deletedAt, выборки по умолчанию скрывают уволенных
export function defineTechnician(sequelize) {
  return sequelize.define(
    "Technician",
    {
      id: uuidId(),
      fullName: { type: DataTypes.STRING(150), allowNull: false },
      specialization: { type: DataTypes.STRING(100), allowNull: false },
      employeeNumber: { type: DataTypes.STRING(20), allowNull: false },
    },
    { tableName: "technicians", paranoid: true },
  );
}
