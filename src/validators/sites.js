import { z } from "zod";
import { requiredString, optionalString, listQuery, location } from "./common.js";
import { SITE_SORT_FIELDS } from "../models/site.js";

const NAME_MESSAGE = "Длина должна быть от 2 до 100 символов";
const CODE_MESSAGE = "Код: 2-20 символов, латинские буквы, цифры и дефис";

const siteShape = {
  name: requiredString().trim().min(2, { error: NAME_MESSAGE }).max(100, { error: NAME_MESSAGE }),
  code: requiredString()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, { error: CODE_MESSAGE }),
  region: requiredString().trim().min(2, { error: NAME_MESSAGE }).max(100, { error: NAME_MESSAGE }),
  location: location(),
};

export const createSiteSchema = z.object(siteShape);

export const updateSiteSchema = z
  .object(siteShape)
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "Не передано ни одного поля для обновления",
  });

export const siteListQuerySchema = listQuery({
  sortFields: SITE_SORT_FIELDS,
  filters: {
    region: optionalString().trim().max(100, { error: "Не более 100 символов" }).optional(),
    q: optionalString().trim().max(100, { error: "Не более 100 символов" }).optional(),
  },
});

export const siteSummaryQuerySchema = z.object({
  from: z.iso.date({ error: "Ожидается дата в формате ГГГГ-ММ-ДД" }).optional(),
  to: z.iso.date({ error: "Ожидается дата в формате ГГГГ-ММ-ДД" }).optional(),
});
