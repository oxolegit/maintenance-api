import { z } from "zod";

z.config(z.locales.ru());

export const requiredString = () =>
  z.string({
    error: (issue) => (issue.input === undefined ? "Обязательное поле" : "Должно быть строкой"),
  });

export const optionalString = () => z.string({ error: "Должно быть строкой" });

export const enumOf = (values) =>
  z.enum(values, { error: () => `Допустимые значения: ${values.join(", ")}` });

export const numberField = () =>
  z.number({
    error: (issue) => (issue.input === undefined ? "Обязательное поле" : "Должно быть числом"),
  });

export const isoDateTime = () =>
  z.iso.datetime({
    offset: true,
    local: true,
    error: "Ожидается дата и время в формате ISO 8601",
  });

export const isoDate = () =>
  z.union([z.iso.date(), z.iso.datetime({ offset: true, local: true })], {
    error: "Ожидается дата в формате ISO 8601 (ГГГГ-ММ-ДД)",
  });

const LAT_MESSAGE = "Широта должна быть в диапазоне от -90 до 90";
const LON_MESSAGE = "Долгота должна быть в диапазоне от -180 до 180";

export const location = () =>
  z.object(
    {
      lat: numberField().min(-90, { error: LAT_MESSAGE }).max(90, { error: LAT_MESSAGE }),
      lon: numberField().min(-180, { error: LON_MESSAGE }).max(180, { error: LON_MESSAGE }),
    },
    {
      error: (issue) =>
        issue.input === undefined ? "Обязательное поле" : "Ожидается объект вида { lat, lon }",
    },
  );

export const uuid = () => z.uuid({ error: "Ожидается идентификатор в формате UUID" });

export const idParams = z.object({ id: uuid() });

export const dateQuery = () => z.iso.date({ error: "Ожидается дата в формате ГГГГ-ММ-ДД" });

export function listQuery({ sortFields, defaultSort = sortFields[0], filters = {} }) {
  return z.object({
    page: z.coerce
      .number({ error: "Должно быть целым числом от 1 до 10000" })
      .int({ error: "Должно быть целым числом от 1 до 10000" })
      .min(1, { error: "Должно быть целым числом от 1 до 10000" })
      .max(10000, { error: "Должно быть целым числом от 1 до 10000" })
      .default(1),
    limit: z.coerce
      .number({ error: "Должно быть целым числом от 1 до 100" })
      .int({ error: "Должно быть целым числом от 1 до 100" })
      .min(1, { error: "Должно быть целым числом от 1 до 100" })
      .max(100, { error: "Должно быть целым числом от 1 до 100" })
      .default(20),
    sort: enumOf(sortFields).default(defaultSort),
    order: enumOf(["asc", "desc"]).default("desc"),
    ...filters,
  });
}
