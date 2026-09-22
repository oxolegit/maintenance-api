import { z } from "zod";
import { dateQuery, listQuery, uuid } from "./common.js";
import { EQUIPMENT_LOAD_SORT_FIELDS } from "../models/report.js";

// Период по дате создания заявки, минимальное число заявок отсекает группы (HAVING)
export const equipmentLoadQuerySchema = listQuery({
  sortFields: EQUIPMENT_LOAD_SORT_FIELDS,
  filters: {
    from: dateQuery().optional(),
    to: dateQuery().optional(),
    siteId: uuid().optional(),
    minRequests: z.coerce
      .number({ error: "Должно быть целым числом от 0 до 1000" })
      .int({ error: "Должно быть целым числом от 0 до 1000" })
      .min(0, { error: "Должно быть целым числом от 0 до 1000" })
      .max(1000, { error: "Должно быть целым числом от 0 до 1000" })
      .default(1),
  },
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  error: "Дата начала периода не может быть позже даты окончания",
  path: ["from"],
});
