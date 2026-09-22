import { inTransaction } from "../src/db/columns.js";

// Индексы под реальные выборки API: фильтры списков по статусу/приоритету/типу, диапазоны дат
// и сортировка по умолчанию (created_at DESC). Эффект подтверждён в docs/db/indexes.md
const INDEXES = [
  ["maintenance_requests", ["status"]],
  ["maintenance_requests", ["priority"]],
  ["maintenance_requests", ["planned_at"]],
  ["maintenance_requests", ["created_at"]],
  ["maintenance_requests", ["equipment_id", "status"]],
  ["equipment", ["status"]],
  ["equipment", ["type"]],
  ["equipment", ["installed_at"]],
  ["equipment_passports", ["equipment_id"]],
  ["request_status_history", ["request_id", "new_status"]],
];

const indexName = (table, fields) => `${table}_${fields.join("_")}_idx`;

export async function up({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    for (const [table, fields] of INDEXES) {
      await queryInterface.addIndex(table, fields, { name: indexName(table, fields), transaction });
    }
  });
}

export async function down({ context: queryInterface }) {
  await inTransaction(queryInterface, async (transaction) => {
    for (const [table, fields] of INDEXES) {
      await queryInterface.removeIndex(table, indexName(table, fields), { transaction });
    }
  });
}
