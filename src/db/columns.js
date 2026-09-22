import { DataTypes, Op, literal } from "sequelize";

// Общие колонки для миграций: uuid-ключ генерирует сама БД, метки времени — timestamptz
export const uuidPrimaryKey = () => ({
  type: DataTypes.UUID,
  primaryKey: true,
  allowNull: false,
  defaultValue: literal("gen_random_uuid()"),
});

export const timestamps = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal("now()") },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal("now()") },
});

export const foreignKey = (table, { onDelete, allowNull = false } = {}) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model: table, key: "id" },
  onDelete,
  onUpdate: "CASCADE",
});

// Именованный enum-тип создаётся отдельно и переиспользуется несколькими таблицами;
// DataTypes.ENUM в createTable завёл бы свой тип на каждую колонку
export async function createEnum(queryInterface, name, values, { transaction }) {
  const list = values.map((value) => `'${value}'`).join(", ");
  await queryInterface.sequelize.query(`CREATE TYPE ${name} AS ENUM (${list})`, { transaction });
}

export async function dropEnum(queryInterface, name, { transaction }) {
  await queryInterface.sequelize.query(`DROP TYPE IF EXISTS ${name}`, { transaction });
}

export function positiveCheck(queryInterface, table, column, { transaction }) {
  return queryInterface.addConstraint(table, {
    type: "check",
    name: `${table}_${column}_positive`,
    fields: [column],
    where: { [column]: { [Op.gt]: 0 } },
    transaction,
  });
}

export function inTransaction(queryInterface, work) {
  return queryInterface.sequelize.transaction((transaction) => work(transaction));
}
