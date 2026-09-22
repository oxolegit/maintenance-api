import { Op } from "sequelize";

const RANGE_OPERATORS = { in: Op.in, gte: Op.gte, lte: Op.lte, gt: Op.gt, lt: Op.lt };
const TEXT_TYPES = new Set(["STRING", "TEXT"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// В шаблоне LIKE спецсимволы экранируются обратным слешем — ищем подстроку буквально
const escapeLike = (value) => String(value).replace(/[\\%_]/g, "\\$&");

// Sequelize подставляет дату через moment в локальном времени процесса: для timestamptz
// дату без времени дополняем до полуночи UTC, для колонок date время отбрасываем
function normalizeDate(attribute, value) {
  const type = attribute.type.key;
  if (type === "DATEONLY") {
    return String(value).slice(0, 10);
  }
  if (type === "DATE" && DATE_ONLY.test(value)) {
    return `${value}T00:00:00.000Z`;
  }
  return value;
}

function condition(attribute, spec) {
  if (spec === null || typeof spec !== "object") {
    return spec;
  }
  const where = {};
  for (const [name, operator] of Object.entries(RANGE_OPERATORS)) {
    if (spec[name] !== undefined) {
      where[operator] = Array.isArray(spec[name])
        ? spec[name]
        : normalizeDate(attribute, spec[name]);
    }
  }
  if (spec.contains !== undefined) {
    if (!TEXT_TYPES.has(attribute.type.key)) {
      throw new Error(`поиск по подстроке невозможен для поля ${attribute.fieldName}`);
    }
    where[Op.iLike] = `%${escapeLike(spec.contains)}%`;
  }
  return where;
}

// Декларативные фильтры сервисов ({ status, createdAt: { gte, lte }, $or: [...] }) → where ORM.
// Имена полей проверяются по атрибутам модели: в запрос попадают только известные колонки
export function buildWhere(model, filters = {}) {
  const where = {};
  for (const [field, spec] of Object.entries(filters)) {
    if (spec === undefined) {
      continue;
    }
    if (field === "$or") {
      where[Op.or] = spec.map((alternative) => buildWhere(model, alternative));
      continue;
    }
    const attribute = model.rawAttributes[field];
    if (!attribute) {
      throw new Error(`неизвестное поле фильтра: ${field}`);
    }
    where[field] = condition(attribute, spec);
  }
  return where;
}
