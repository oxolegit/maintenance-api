import { QueryTypes } from "sequelize";
import { EQUIPMENT_LOAD_SORT_FIELDS } from "../models/report.js";

// Отчёт «нагрузка на оборудование» — прямой SQL: по каждой единице число заявок за период,
// число закрытых и открытых, суммарные плановые трудозатраты бригад и дата последнего
// обслуживания (переход в done по журналу). Все параметры передаются через bind ($1…$n),
// сортировка — только из белого списка выражений ниже
const LOAD_SQL = `
SELECT e.id AS equipment_id,
       e.name,
       e.serial_number,
       e.type,
       e.status AS equipment_status,
       s.id AS site_id,
       s.name AS site_name,
       CAST(COUNT(r.id) AS int) AS requests_total,
       CAST(COUNT(r.id) FILTER (WHERE r.status = 'done') AS int) AS requests_done,
       CAST(COUNT(r.id) FILTER (WHERE r.status IN ('new', 'in_progress')) AS int) AS requests_open,
       CAST(COALESCE(SUM(a.hours), 0) AS double precision) AS planned_hours,
       MAX(h.done_at) AS last_maintenance_at
FROM equipment e
LEFT JOIN sites s ON s.id = e.site_id
LEFT JOIN maintenance_requests r
       ON r.equipment_id = e.id
      AND ($1::timestamptz IS NULL OR r.created_at >= $1::timestamptz)
      AND ($2::timestamptz IS NULL OR r.created_at <= $2::timestamptz)
LEFT JOIN LATERAL (
       SELECT SUM(ra.hours) AS hours FROM request_assignees ra WHERE ra.request_id = r.id
     ) a ON true
LEFT JOIN LATERAL (
       SELECT MAX(hh.changed_at) AS done_at
       FROM request_status_history hh
       WHERE hh.request_id = r.id AND hh.new_status = 'done'
     ) h ON true
WHERE ($3::uuid IS NULL OR e.site_id = $3::uuid)
GROUP BY e.id, s.id
HAVING COUNT(r.id) >= $4`;

// значение sort из запроса никогда не попадает в SQL напрямую — только выражение из этой таблицы
const SORT_EXPRESSIONS = {
  requestsTotal: "requests_total",
  requestsDone: "requests_done",
  requestsOpen: "requests_open",
  plannedHours: "planned_hours",
  lastMaintenanceAt: "last_maintenance_at",
  name: "e.name",
};

for (const field of EQUIPMENT_LOAD_SORT_FIELDS) {
  if (!SORT_EXPRESSIONS[field]) {
    throw new Error(`нет выражения сортировки для поля ${field}`);
  }
}

function toItem(row) {
  return {
    equipmentId: row.equipment_id,
    name: row.name,
    serialNumber: row.serial_number,
    type: row.type,
    status: row.equipment_status,
    site: row.site_id ? { id: row.site_id, name: row.site_name } : null,
    requestsTotal: row.requests_total,
    requestsDone: row.requests_done,
    requestsOpen: row.requests_open,
    plannedHours: row.planned_hours,
    lastMaintenanceAt: row.last_maintenance_at ? row.last_maintenance_at.toISOString() : null,
  };
}

export class ReportRepository {
  constructor({ sequelize }) {
    this.sequelize = sequelize;
  }

  async equipmentLoad({ from, to, siteId, minRequests, sort, order, page, limit }) {
    const direction = order === "asc" ? "ASC" : "DESC";
    const orderBy = `${SORT_EXPRESSIONS[sort]} ${direction} NULLS LAST, e.name ASC`;
    const bind = [from, to, siteId, minRequests];

    const [rows, [{ total }]] = await Promise.all([
      this.sequelize.query(`${LOAD_SQL}\nORDER BY ${orderBy}\nLIMIT $5 OFFSET $6`, {
        type: QueryTypes.SELECT,
        bind: [...bind, limit, (page - 1) * limit],
      }),
      this.sequelize.query(`SELECT CAST(COUNT(*) AS int) AS total FROM (${LOAD_SQL}) AS groups`, {
        type: QueryTypes.SELECT,
        bind,
      }),
    ]);

    return { items: rows.map(toItem), total };
  }
}
