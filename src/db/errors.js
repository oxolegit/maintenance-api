import {
  UniqueConstraintError,
  ForeignKeyConstraintError,
  ValidationError as SequelizeValidationError,
  ConnectionError,
  DatabaseError,
} from "sequelize";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../errors/index.js";

const toCamel = (column) => column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

// Из detail вида: Key (technician_id)=(...) is not present in table "technicians".
const FK_DETAIL =
  /Key \((?<column>[^)]+)\)=\([^)]*\) (?<reason>is not present in table|is still referenced from table) "(?<table>[^"]+)"/;

function uniqueViolation(error) {
  const fields = error.errors.length
    ? error.errors.map((item) => toCamel(item.path))
    : [error.parent?.constraint ?? "unique"];
  return new ConflictError("Значение уже используется", {
    code: "UNIQUE_VIOLATION",
    details: fields.map((field) => ({ field, message: "Значение уже используется" })),
  });
}

function foreignKeyViolation(error) {
  const match = FK_DETAIL.exec(error.parent?.detail ?? "");
  const field = match ? toCamel(match.groups.column) : error.fields?.[0];
  if (match?.groups.reason === "is not present in table") {
    return new NotFoundError("Связанная запись не найдена", {
      code: "RELATED_NOT_FOUND",
      ...(field && { details: [{ field, message: "Запись не найдена" }] }),
    });
  }
  return new ConflictError("Запись используется другими данными", {
    code: "RESOURCE_IN_USE",
    details: [{ field, message: `на запись ссылается таблица ${match?.groups.table ?? "?"}` }],
  });
}

const DATABASE_CODES = {
  // check-ограничение: значение не прошло правило схемы
  23514: (error) =>
    new ValidationError([{ field: error.parent.constraint, message: "Нарушено ограничение" }]),
  // неверный формат литерала (uuid, enum, число)
  "22P02": (error) => new BadRequestError(`Некорректное значение: ${error.parent.message}`),
  // исключение из триггера журнала статусов
  P0001: (error) => new ConflictError(error.parent.message, { code: "HISTORY_IMMUTABLE" }),
  // взаимная блокировка или конфликт сериализации — операцию можно повторить
  "40P01": () => concurrentUpdate(),
  40001: () => concurrentUpdate(),
};

const concurrentUpdate = () =>
  new ConflictError("Запись изменяется параллельно, повторите запрос", {
    code: "CONCURRENT_UPDATE",
  });

// Ошибки ORM и PostgreSQL → ошибки приложения в едином формате ответа.
// Порядок проверок важен: UniqueConstraintError наследует ValidationError Sequelize
export function mapDbError(error) {
  if (error instanceof UniqueConstraintError) {
    return uniqueViolation(error);
  }
  if (error instanceof ForeignKeyConstraintError) {
    return foreignKeyViolation(error);
  }
  if (error instanceof SequelizeValidationError) {
    return new ValidationError(
      error.errors.map((item) => ({ field: item.path, message: item.message })),
    );
  }
  if (error instanceof ConnectionError) {
    return new AppError("База данных недоступна", { status: 503, code: "DB_UNAVAILABLE" });
  }
  if (error instanceof DatabaseError) {
    const mapper = DATABASE_CODES[error.parent?.code];
    return mapper ? mapper(error) : null;
  }
  return null;
}
