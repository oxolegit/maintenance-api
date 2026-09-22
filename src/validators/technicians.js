import { z } from "zod";
import { requiredString, optionalString, listQuery } from "./common.js";
import { TECHNICIAN_SORT_FIELDS } from "../models/technician.js";

const NAME_MESSAGE = "Длина должна быть от 5 до 150 символов";
const SPECIALIZATION_MESSAGE = "Длина должна быть от 2 до 100 символов";
const NUMBER_MESSAGE = "Табельный номер: 1-20 символов, латинские буквы, цифры и дефис";

const technicianShape = {
  fullName: requiredString()
    .trim()
    .min(5, { error: NAME_MESSAGE })
    .max(150, { error: NAME_MESSAGE }),
  specialization: requiredString()
    .trim()
    .min(2, { error: SPECIALIZATION_MESSAGE })
    .max(100, { error: SPECIALIZATION_MESSAGE }),
  employeeNumber: requiredString()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,20}$/, { error: NUMBER_MESSAGE }),
};

export const createTechnicianSchema = z.object(technicianShape);

export const updateTechnicianSchema = z
  .object(technicianShape)
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "Не передано ни одного поля для обновления",
  });

export const technicianListQuerySchema = listQuery({
  sortFields: TECHNICIAN_SORT_FIELDS,
  defaultSort: "fullName",
  filters: {
    specialization: optionalString().trim().max(100, { error: "Не более 100 символов" }).optional(),
    q: optionalString().trim().max(100, { error: "Не более 100 символов" }).optional(),
  },
});
