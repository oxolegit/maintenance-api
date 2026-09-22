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
    await createEnum(queryInterface, "request_priority", ["low", "medium", "high", "critical"], {
      transaction,
    });
    await createEnum(queryInterface, "request_status", ["new", "in_progress", "done", "rejected"], {
      transaction,
    });

    await queryInterface.createTable(
      "maintenance_requests",
      {
        id: uuidPrimaryKey(),
        // заявки удаляются вместе с оборудованием; открытые заявки блокируют удаление на уровне сервиса
        equipment_id: foreignKey("equipment", { onDelete: "CASCADE" }),
        title: { type: DataTypes.STRING(120), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
        priority: { type: "request_priority", allowNull: false, defaultValue: "medium" },
        status: { type: "request_status", allowNull: false, defaultValue: "new" },
        planned_at: { type: DataTypes.DATE, allowNull: true },
        author: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "system" },
        ...timestamps(),
      },
      { transaction },
    );
    await queryInterface.addIndex("maintenance_requests", ["equipment_id"], { transaction });
  });
}

export async function down({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.dropTable("maintenance_requests", { transaction });
    await dropEnum(queryInterface, "request_status", { transaction });
    await dropEnum(queryInterface, "request_priority", { transaction });
  });
}
