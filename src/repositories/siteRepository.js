import { QueryTypes } from "sequelize";
import { SequelizeRepository } from "./sequelizeRepository.js";
import { siteToRow, siteToItem } from "./serializers.js";
import { REQUEST_STATUSES, REQUEST_PRIORITIES } from "../models/request.js";

// Сводка по площадке считается в БД: количество заявок по статусам и приоритетам
// за период и среднее время от создания заявки до перевода в done (по журналу статусов)
const COUNTS_SQL = `
SELECT r.status, r.priority, CAST(COUNT(*) AS int) AS count
FROM maintenance_requests r
JOIN equipment e ON e.id = r.equipment_id
WHERE e.site_id = $1
  AND ($2::timestamptz IS NULL OR r.created_at >= $2::timestamptz)
  AND ($3::timestamptz IS NULL OR r.created_at <= $3::timestamptz)
GROUP BY r.status, r.priority`;

const CLOSE_TIME_SQL = `
SELECT CAST(COUNT(*) AS int) AS closed,
       CAST(EXTRACT(EPOCH FROM AVG(h.changed_at - r.created_at)) / 3600 AS double precision)
         AS avg_close_hours
FROM maintenance_requests r
JOIN equipment e ON e.id = r.equipment_id
JOIN request_status_history h ON h.request_id = r.id AND h.new_status = 'done'
WHERE e.site_id = $1
  AND ($2::timestamptz IS NULL OR r.created_at >= $2::timestamptz)
  AND ($3::timestamptz IS NULL OR r.created_at <= $3::timestamptz)`;

const zeros = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

export class SiteRepository extends SequelizeRepository {
  constructor({ Site }) {
    super({ model: Site, toRow: siteToRow, toItem: siteToItem });
  }

  async summary(siteId, { from = null, to = null } = {}) {
    const bind = [siteId, from, to];
    const options = { type: QueryTypes.SELECT, bind };
    const [rows, [closeTime]] = await Promise.all([
      this.model.sequelize.query(COUNTS_SQL, options),
      this.model.sequelize.query(CLOSE_TIME_SQL, options),
    ]);

    const byStatus = zeros(REQUEST_STATUSES);
    const byPriority = zeros(REQUEST_PRIORITIES);
    let total = 0;
    for (const { status, priority, count } of rows) {
      byStatus[status] += count;
      byPriority[priority] += count;
      total += count;
    }

    return {
      total,
      open: byStatus.new + byStatus.in_progress,
      byStatus,
      byPriority,
      closed: closeTime.closed,
      avgCloseHours:
        closeTime.avg_close_hours === null ? null : Math.round(closeTime.avg_close_hours * 10) / 10,
    };
  }
}
