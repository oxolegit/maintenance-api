import { DataTypes } from "sequelize";
import { uuidId } from "./common.js";

export function definePart(sequelize) {
  return sequelize.define(
    "Part",
    {
      id: uuidId(),
      name: { type: DataTypes.STRING(100), allowNull: false },
      sku: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      unit: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "шт" },
      stockQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: "parts" },
  );
}

export function defineRequestPart(sequelize) {
  return sequelize.define(
    "RequestPart",
    {
      requestId: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      partId: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
    },
    { tableName: "request_parts" },
  );
}
