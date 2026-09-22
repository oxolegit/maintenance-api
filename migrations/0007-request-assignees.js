import { DataTypes, literal } from "sequelize";
import {
  foreignKey,
  createEnum,
  dropEnum,
  positiveCheck,
  inTransaction,
} from "../src/db/columns.js";

export async function up({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await createEnum(queryInterface, "assignee_role", ["lead", "member"], { transaction });

    await queryInterface.createTable(
      "request_assignees",
      {
        // составной ключ: один специалист назначается на заявку не более одного раза
        request_id: {
          ...foreignKey("maintenance_requests", { onDelete: "CASCADE" }),
          primaryKey: true,
        },
        // специалиста с назначениями удалить нельзя
        technician_id: { ...foreignKey("technicians", { onDelete: "RESTRICT" }), primaryKey: true },
        role: { type: "assignee_role", allowNull: false, defaultValue: "member" },
        hours: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal("now()") },
      },
      { transaction },
    );
    await positiveCheck(queryInterface, "request_assignees", "hours", { transaction });
    await queryInterface.addIndex("request_assignees", ["technician_id"], { transaction });
    // в бригаде не больше одного ведущего — гарантия на уровне БД даже при параллельных запросах
    await queryInterface.addIndex("request_assignees", ["request_id"], {
      unique: true,
      name: "request_assignees_single_lead",
      where: { role: "lead" },
      transaction,
    });
  });
}

export async function down({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.dropTable("request_assignees", { transaction });
    await dropEnum(queryInterface, "assignee_role", { transaction });
  });
}
