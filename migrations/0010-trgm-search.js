import { inTransaction } from "../src/db/columns.js";

// Поиск по подстроке (ILIKE '%…%') не использует обычный B-tree; GIN-индекс по триграммам
// (расширение pg_trgm, доверенное — ставится владельцем базы) ускоряет такие запросы
const TRGM_INDEXES = [
  ["equipment", "name"],
  ["equipment", "serial_number"],
  ["maintenance_requests", "title"],
  ["technicians", "full_name"],
];

const indexName = (table, column) => `${table}_${column}_trgm_idx`;

export async function up({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    await queryInterface.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm", {
      transaction,
    });
    for (const [table, column] of TRGM_INDEXES) {
      await queryInterface.sequelize.query(
        `CREATE INDEX ${indexName(table, column)} ON ${table} USING gin (${column} gin_trgm_ops)`,
        { transaction },
      );
    }
  });
}

export async function down({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    for (const [table, column] of TRGM_INDEXES) {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexName(table, column)}`, {
        transaction,
      });
    }
    await queryInterface.sequelize.query("DROP EXTENSION IF EXISTS pg_trgm", { transaction });
  });
}
