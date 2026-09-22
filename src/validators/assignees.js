import { z } from "zod";
import { enumOf, numberField, uuid } from "./common.js";
import { ASSIGNEE_ROLES } from "../models/assignee.js";

const HOURS_MESSAGE = "Плановые трудозатраты: число больше 0 и не более 9999.99";

const assigneeSchema = z.object({
  technicianId: uuid(),
  role: enumOf(ASSIGNEE_ROLES).default("member"),
  hours: numberField()
    .positive({ error: HOURS_MESSAGE })
    .max(9999.99, { error: HOURS_MESSAGE })
    .multipleOf(0.01, { error: "Не более двух знаков после запятой" }),
});

// Бригада передаётся целиком и заменяет прежний состав; ровно один lead проверяет сервис
export const assignBrigadeSchema = z.object({
  assignees: z
    .array(assigneeSchema, { error: "Ожидается массив назначений" })
    .min(1, { error: "Бригада не может быть пустой" })
    .max(20, { error: "Не более 20 специалистов в бригаде" }),
});

export const assigneeParams = z.object({ id: uuid(), technicianId: uuid() });
