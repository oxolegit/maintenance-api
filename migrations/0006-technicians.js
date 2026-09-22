import { DataTypes } from "sequelize";
import { uuidPrimaryKey, timestamps, inTransaction } from "../src/db/columns.js";

export async function up({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.createTable(
      "technicians",
      {
        id: uuidPrimaryKey(),
        full_name: { type: DataTypes.STRING(150), allowNull: false },
        specialization: { type: DataTypes.STRING(100), allowNull: false },
        employee_number: { type: DataTypes.STRING(20), allowNull: false },
        // мягкое удаление: специалист остаётся в истории назначений
        deleted_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps(),
      },
      { transaction },
    );
    // табельный номер уникален среди действующих сотрудников, уволенный его не занимает
    await queryInterface.addIndex("technicians", ["employee_number"], {
      unique: true,
      name: "technicians_employee_number_active",
      where: { deleted_at: null },
      transaction,
    });
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("technicians");
}
