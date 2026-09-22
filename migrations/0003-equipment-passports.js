import { DataTypes } from "sequelize";
import {
  uuidPrimaryKey,
  timestamps,
  foreignKey,
  positiveCheck,
  inTransaction,
} from "../src/db/columns.js";

export async function up({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.createTable(
      "equipment_passports",
      {
        id: uuidPrimaryKey(),
        // уникальный внешний ключ даёт связь 1:1; паспорт живёт вместе с оборудованием
        equipment_id: { ...foreignKey("equipment", { onDelete: "CASCADE" }), unique: true },
        manufacturer: { type: DataTypes.STRING(100), allowNull: false },
        model: { type: DataTypes.STRING(100), allowNull: false },
        rated_power_kw: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        last_inspection_at: { type: DataTypes.DATEONLY, allowNull: true },
        ...timestamps(),
      },
      { transaction },
    );
    await positiveCheck(queryInterface, "equipment_passports", "rated_power_kw", { transaction });
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("equipment_passports");
}
