import { z } from "zod";
import {
  requiredString,
  optionalString,
  enumOf,
  numberField,
  isoDate,
  dateQuery,
  listQuery,
} from "./common.js";
import { EQUIPMENT_TYPES, EQUIPMENT_STATUSES, EQUIPMENT_SORT_FIELDS } from "../models/equipment.js";

const NAME_MESSAGE = "Длина должна быть от 3 до 100 символов";
const LAT_MESSAGE = "Широта должна быть в диапазоне от -90 до 90";
const LON_MESSAGE = "Долгота должна быть в диапазоне от -180 до 180";

const location = z.object(
  {
    lat: numberField().min(-90, { error: LAT_MESSAGE }).max(90, { error: LAT_MESSAGE }),
    lon: numberField().min(-180, { error: LON_MESSAGE }).max(180, { error: LON_MESSAGE }),
  },
  {
    error: (issue) =>
      issue.input === undefined ? "Обязательное поле" : "Ожидается объект вида { lat, lon }",
  },
);

const notInFuture = (value) => new Date(value).getTime() <= Date.now();

const equipmentShape = {
  name: requiredString().trim().min(3, { error: NAME_MESSAGE }).max(100, { error: NAME_MESSAGE }),
  type: enumOf(EQUIPMENT_TYPES),
  serialNumber: requiredString()
    .trim()
    .min(1, { error: "Обязательное поле" })
    .max(64, { error: "Не более 64 символов" }),
  location,
  status: enumOf(EQUIPMENT_STATUSES),
  installedAt: isoDate().refine(notInFuture, { error: "Дата установки не может быть в будущем" }),
};

export const createEquipmentSchema = z.object({
  ...equipmentShape,
  status: equipmentShape.status.default("operational"),
});

export const updateEquipmentSchema = z
  .object(equipmentShape)
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "Не передано ни одного поля для обновления",
  });

export const equipmentListQuerySchema = listQuery({
  sortFields: EQUIPMENT_SORT_FIELDS,
  filters: {
    type: enumOf(EQUIPMENT_TYPES).optional(),
    status: enumOf(EQUIPMENT_STATUSES).optional(),
    installedFrom: dateQuery().optional(),
    installedTo: dateQuery().optional(),
    q: optionalString().trim().max(100, { error: "Не более 100 символов" }).optional(),
  },
});
