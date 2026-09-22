import { DataTypes } from "sequelize";
import { uuidId, decimal } from "./common.js";

export function defineSite(sequelize) {
  return sequelize.define(
    "Site",
    {
      id: uuidId(),
      name: { type: DataTypes.STRING(100), allowNull: false },
      code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      region: { type: DataTypes.STRING(100), allowNull: false },
      latitude: decimal("latitude", 9, 6, { allowNull: false }),
      longitude: decimal("longitude", 9, 6, { allowNull: false }),
    },
    { tableName: "sites" },
  );
}
