import { DataTypes } from "sequelize";
import { EQUIPMENT_TYPES, EQUIPMENT_STATUSES } from "../../models/equipment.js";
import { uuidId, decimal } from "./common.js";

export function defineEquipment(sequelize) {
  return sequelize.define(
    "Equipment",
    {
      id: uuidId(),
      siteId: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      type: { type: DataTypes.ENUM(...EQUIPMENT_TYPES), allowNull: false },
      serialNumber: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      status: {
        type: DataTypes.ENUM(...EQUIPMENT_STATUSES),
        allowNull: false,
        defaultValue: "operational",
      },
      latitude: decimal("latitude", 9, 6, { allowNull: false }),
      longitude: decimal("longitude", 9, 6, { allowNull: false }),
      installedAt: { type: DataTypes.DATEONLY, allowNull: false },
    },
    { tableName: "equipment" },
  );
}
