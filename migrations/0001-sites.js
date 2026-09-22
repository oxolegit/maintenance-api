import { DataTypes } from "sequelize";
import { uuidPrimaryKey, timestamps, inTransaction } from "../src/db/columns.js";

export async function up({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.createTable(
      "sites",
      {
        id: uuidPrimaryKey(),
        name: { type: DataTypes.STRING(100), allowNull: false },
        code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        region: { type: DataTypes.STRING(100), allowNull: false },
        latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
        longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
        ...timestamps(),
      },
      { transaction },
    );
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("sites");
}
