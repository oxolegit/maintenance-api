import { DataTypes } from "sequelize";
import {
  uuidPrimaryKey,
  timestamps,
  foreignKey,
  createEnum,
  dropEnum,
  inTransaction,
} from "../src/db/columns.js";

export async function up({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await createEnum(
      queryInterface,
      "equipment_type",
      ["turbine", "inverter", "sensor", "substation"],
      { transaction },
    );
    await createEnum(
      queryInterface,
      "equipment_status",
      ["operational", "maintenance", "fault", "decommissioned"],
      { transaction },
    );

    await queryInterface.createTable(
      "equipment",
      {
        id: uuidPrimaryKey(),
        // площадка может быть не назначена (оборудование на складе); удалить площадку
        // с оборудованием нельзя
        site_id: foreignKey("sites", { onDelete: "RESTRICT", allowNull: true }),
        name: { type: DataTypes.STRING(100), allowNull: false },
        type: { type: "equipment_type", allowNull: false },
        serial_number: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        status: { type: "equipment_status", allowNull: false, defaultValue: "operational" },
        latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
        longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
        installed_at: { type: DataTypes.DATEONLY, allowNull: false },
        ...timestamps(),
      },
      { transaction },
    );
    await queryInterface.addIndex("equipment", ["site_id"], { transaction });
  });
}

export async function down({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.dropTable("equipment", { transaction });
    await dropEnum(queryInterface, "equipment_status", { transaction });
    await dropEnum(queryInterface, "equipment_type", { transaction });
  });
}
