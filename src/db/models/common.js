import { DataTypes } from "sequelize";

export const uuidId = () => ({
  type: DataTypes.UUID,
  primaryKey: true,
  allowNull: false,
  defaultValue: DataTypes.UUIDV4,
});

// pg отдаёт numeric и bigint строками, чтобы не терять точность; в модели нужны числа
const numericGetter = (name) =>
  function () {
    const value = this.getDataValue(name);
    return value === null || value === undefined ? value : Number(value);
  };

export const decimal = (name, precision, scale, options = {}) => ({
  type: DataTypes.DECIMAL(precision, scale),
  ...options,
  get: numericGetter(name),
});

export const bigint = (name, options = {}) => ({
  type: DataTypes.BIGINT,
  ...options,
  get: numericGetter(name),
});
