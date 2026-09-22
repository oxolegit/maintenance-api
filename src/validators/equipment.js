import { z } from "zod";
import {
  requiredString,
  optionalString,
  enumOf,
  isoDate,
  dateQuery,
  listQuery,
  location,
  uuid,
} from "./common.js";
import { EQUIPMENT_TYPES, EQUIPMENT_STATUSES, EQUIPMENT_SORT_FIELDS } from "../models/equipment.js";

const NAME_MESSAGE = "Длина должна быть от 3 до 100 символов";

const notInFuture = (value) => new Date(value).getTime() <= Date.now();

const equipmentShape = {
  // площадка необязательна: оборудование может быть заведено до размещения
  siteId: uuid().nullable(),
  name: requiredString().trim().min(3, { error: NAME_MESSAGE }).max(100, { error: NAME_MESSAGE }),
  type: enumOf(EQUIPMENT_TYPES),
  serialNumber: requiredString()
    .trim()
    .min(1, { error: "Обязательное поле" })
    .max(64, { error: "Не более 64 символов" }),
  location: location(),
  status: enumOf(EQUIPMENT_STATUSES),
  installedAt: isoDate().refine(notInFuture, { error: "Дата установки не может быть в будущем" }),
};

export const createEquipmentSchema = z.object({
  ...equipmentShape,
  siteId: equipmentShape.siteId.default(null),
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
    siteId: uuid().optional(),
    type: enumOf(EQUIPMENT_TYPES).optional(),
    status: enumOf(EQUIPMENT_STATUSES).optional(),
    installedFrom: dateQuery().optional(),
    installedTo: dateQuery().optional(),
    q: optionalString().trim().max(100, { error: "Не более 100 символов" }).optional(),
  },
});

export const weatherQuerySchema = z.object({
  days: z.coerce
    .number({ error: "Должно быть целым числом от 1 до 7" })
    .int({ error: "Должно быть целым числом от 1 до 7" })
    .min(1, { error: "Должно быть целым числом от 1 до 7" })
    .max(7, { error: "Должно быть целым числом от 1 до 7" })
    .optional(),
});
