import { DataTypes } from "sequelize";
import { uuidId, decimal } from "./common.js";

export function defineEquipmentPassport(sequelize) {
  return sequelize.define(
    "EquipmentPassport",
    {
      id: uuidId(),
      equipmentId: { type: DataTypes.UUID, allowNull: false, unique: true },
      manufacturer: { type: DataTypes.STRING(100), allowNull: false },
      model: { type: DataTypes.STRING(100), allowNull: false },
      ratedPowerKw: decimal("ratedPowerKw", 10, 2, { allowNull: false }),
      lastInspectionAt: { type: DataTypes.DATEONLY, allowNull: true },
    },
    { tableName: "equipment_passports" },
  );
}
