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

const requestShape = {
  equipmentId: uuid(),
  title: requiredString()
    .trim()
    .min(5, { error: TITLE_MESSAGE })
    .max(120, { error: TITLE_MESSAGE }),
  description: optionalString().trim().max(2000, { error: "Не более 2000 символов" }),
  priority: enumOf(REQUEST_PRIORITIES),
  plannedAt: isoDateTime().nullable(),
};

export const createRequestSchema = z.object({
  ...requestShape,
  description: requestShape.description.default(""),
  priority: requestShape.priority.default("medium"),
  plannedAt: requestShape.plannedAt.default(null),
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
