import { z } from "zod";
import {
  requiredString,
  optionalString,
  enumOf,
  uuid,
  isoDateTime,
  dateQuery,
  listQuery,
} from "./common.js";
import { REQUEST_PRIORITIES, REQUEST_STATUSES, REQUEST_SORT_FIELDS } from "../models/request.js";

const TITLE_MESSAGE = "Длина должна быть от 5 до 120 символов";
const AUTHOR_MESSAGE = "Длина должна быть от 1 до 100 символов";

// автор действия: имя или логин; аутентификации по пользователям нет, поэтому по умолчанию system
const author = () =>
  optionalString().trim().min(1, { error: AUTHOR_MESSAGE }).max(100, { error: AUTHOR_MESSAGE });

const requestShape = {
  equipmentId: uuid(),
  title: requiredString()
    .trim()
    .min(5, { error: TITLE_MESSAGE })
    .max(120, { error: TITLE_MESSAGE }),
  description: optionalString().trim().max(2000, { error: "Не более 2000 символов" }),
  priority: enumOf(REQUEST_PRIORITIES),
  plannedAt: isoDateTime().nullable(),
  author: author(),
};

export const createRequestSchema = z.object({
  ...requestShape,
  description: requestShape.description.default(""),
  priority: requestShape.priority.default("medium"),
  plannedAt: requestShape.plannedAt.default(null),
  author: requestShape.author.default("system"),
});

export const updateRequestSchema = z
  .object({
    title: requestShape.title,
    description: requestShape.description,
    priority: requestShape.priority,
    plannedAt: requestShape.plannedAt,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "Не передано ни одного поля для обновления",
  });

export const changeStatusSchema = z.object({
  status: enumOf(REQUEST_STATUSES),
  author: author().default("system"),
  comment: optionalString()
    .trim()
    .max(500, { error: "Не более 500 символов" })
    .nullable()
    .default(null),
});

const requestFilters = {
  status: enumOf(REQUEST_STATUSES).optional(),
  priority: enumOf(REQUEST_PRIORITIES).optional(),
  createdFrom: dateQuery().optional(),
  createdTo: dateQuery().optional(),
  plannedFrom: dateQuery().optional(),
  plannedTo: dateQuery().optional(),
};

export const requestListQuerySchema = listQuery({
  sortFields: REQUEST_SORT_FIELDS,
  filters: { ...requestFilters, equipmentId: uuid().optional() },
});

export const equipmentRequestsQuerySchema = listQuery({
  sortFields: REQUEST_SORT_FIELDS,
  filters: requestFilters,
});

export const batchRequestsSchema = z.object({
  items: z
    .array(z.unknown(), { error: "Ожидается массив items" })
    .min(1, { error: "Массив items не должен быть пустым" })
    .max(100, { error: "За один запрос можно импортировать не более 100 заявок" }),
});

export function validateRequestItem(item) {
  const result = createRequestSchema.safeParse(item);
  if (result.success) {
    return { data: result.data };
  }
  return {
    details: result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "item",
      message: issue.message,
    })),
  };
}
