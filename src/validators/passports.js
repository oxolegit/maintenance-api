import { z } from "zod";
import { requiredString, numberField, isoDate } from "./common.js";

const TEXT_MESSAGE = "Длина должна быть от 1 до 100 символов";

export const passportSchema = z.object({
  manufacturer: requiredString()
    .trim()
    .min(1, { error: TEXT_MESSAGE })
    .max(100, { error: TEXT_MESSAGE }),
  model: requiredString().trim().min(1, { error: TEXT_MESSAGE }).max(100, { error: TEXT_MESSAGE }),
  ratedPowerKw: numberField()
    .positive({ error: "Мощность должна быть больше нуля" })
    .max(99999999, { error: "Слишком большое значение" }),
  lastInspectionAt: isoDate().nullable().default(null),
});
