import { DataTypes, literal } from "sequelize";
import {
  uuidPrimaryKey,
  timestamps,
  foreignKey,
  positiveCheck,
  inTransaction,
} from "../src/db/columns.js";

// Склад запчастей и расход по заявкам: ещё одна связь N:M с количеством в связующей таблице.
// Остаток не может уйти в минус — это гарантирует CHECK, а списание выполняется условным
// UPDATE внутри транзакции сервиса
export async function up({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.createTable(
      "parts",
      {
        id: uuidPrimaryKey(),
        name: { type: DataTypes.STRING(100), allowNull: false },
        sku: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        unit: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "шт" },
        stock_qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestamps(),
      },
      { transaction },
    );
    await queryInterface.addConstraint("parts", {
      type: "check",
      name: "parts_stock_qty_non_negative",
      fields: ["stock_qty"],
      where: { stock_qty: { [queryInterface.sequelize.Sequelize.Op.gte]: 0 } },
      transaction,
    });

    await queryInterface.createTable(
      "request_parts",
      {
        request_id: {
          ...foreignKey("maintenance_requests", { onDelete: "CASCADE" }),
          primaryKey: true,
        },
        // запчасть, списанная хотя бы на одну заявку, из справочника не удаляется
        part_id: { ...foreignKey("parts", { onDelete: "RESTRICT" }), primaryKey: true },
        quantity: { type: DataTypes.INTEGER, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal("now()") },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal("now()") },
      },
      { transaction },
    );
    await positiveCheck(queryInterface, "request_parts", "quantity", { transaction });
    await queryInterface.addIndex("request_parts", ["part_id"], { transaction });
  });
}

export async function down({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.dropTable("request_parts", { transaction });
    await queryInterface.dropTable("parts", { transaction });
  });
}
