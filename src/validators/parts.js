import { z } from "zod";
import { requiredString, optionalString, listQuery, uuid } from "./common.js";
import { PART_SORT_FIELDS } from "../models/part.js";

const NAME_MESSAGE = "Длина должна быть от 2 до 100 символов";
const SKU_MESSAGE = "Артикул: 2-40 символов, латинские буквы, цифры, точка и дефис";
const QTY_MESSAGE = "Количество должно быть целым числом от 0 до 1000000";
const WRITE_OFF_MESSAGE = "Количество должно быть целым числом от 1 до 10000";

const quantity = (min, max, message) =>
  z.coerce
    .number({ error: message })
    .int({ error: message })
    .min(min, { error: message })
    .max(max, { error: message });

const partShape = {
  name: requiredString().trim().min(2, { error: NAME_MESSAGE }).max(100, { error: NAME_MESSAGE }),
  sku: requiredString()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9.-]{2,40}$/, { error: SKU_MESSAGE }),
  unit: optionalString()
    .trim()
    .min(1, { error: "Обязательное поле" })
    .max(10, { error: "Не более 10 символов" }),
  stockQty: quantity(0, 1000000, QTY_MESSAGE),
};

export const createPartSchema = z.object({
  ...partShape,
  unit: partShape.unit.default("шт"),
  stockQty: partShape.stockQty.default(0),
});

// stockQty в PATCH — приход на склад: остаток задаётся целиком (инвентаризация)
export const updatePartSchema = z
  .object(partShape)
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "Не передано ни одного поля для обновления",
  });

export const partListQuerySchema = listQuery({
  sortFields: PART_SORT_FIELDS,
  filters: {
    q: optionalString().trim().max(100, { error: "Не более 100 символов" }).optional(),
    inStock: z
      .enum(["true", "false"], { error: "Допустимые значения: true, false" })
      .transform((value) => value === "true")
      .optional(),
  },
});

export const writeOffSchema = z.object({
  items: z
    .array(
      z.object({
        partId: uuid(),
        quantity: quantity(1, 10000, WRITE_OFF_MESSAGE),
      }),
      { error: "Ожидается массив позиций" },
    )
    .min(1, { error: "Список позиций не может быть пустым" })
    .max(50, { error: "Не более 50 позиций за раз" }),
});

export const requestPartParams = z.object({ id: uuid(), partId: uuid() });
