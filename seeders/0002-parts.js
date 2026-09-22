// Склад запчастей и расход по уже закрытым демо-заявкам (идентификаторы заявок — из 0001-demo)

const at = (date) => new Date(`${date}T09:00:00Z`);

// prettier-ignore
const PARTS = [
  ["01", "Подшипник главного вала SKF 23148",  "BRG-23148",  "шт", 4],
  ["02", "Тормозная колодка ротора",           "BRK-PAD-90", "шт", 12],
  ["03", "Масло редукторное Mobil SHC 320",    "OIL-SHC320", "л",  180],
  ["04", "Лопасть V90 (секция)",               "BLD-V90",    "шт", 1],
  ["05", "Вентилятор охлаждения инвертора",    "FAN-SC2200", "шт", 6],
  ["06", "Ограничитель перенапряжения 35 кВ",  "OPN-35",     "шт", 9],
  ["07", "Анемометр Thies First Class",        "ANM-TFC",    "шт", 3],
  ["08", "Фильтр гидросистемы",                "FLT-HYD",    "шт", 0],
].map(([n, name, sku, unit, stockQty]) => ({
  id: `50000000-0000-4000-8000-0000000000${n}`,
  name,
  sku,
  unit,
  stockQty,
}));

// [заявка, артикул, количество, дата списания]
// prettier-ignore
const USAGE = [
  ["03", "BRK-PAD-90", 2, "2026-06-05"],
  ["05", "BLD-V90",    1, "2026-07-04"],
  ["06", "OIL-SHC320", 40, "2026-08-13"],
  ["08", "FAN-SC2200", 2, "2026-05-23"],
  ["14", "ANM-TFC",    1, "2026-04-10"],
  ["19", "OIL-SHC320", 60, "2026-06-28"],
  ["19", "FLT-HYD",    2, "2026-06-28"],
];

export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const seededAt = at("2026-01-10");
    const partBySku = Object.fromEntries(PARTS.map((part) => [part.sku, part.id]));

    await queryInterface.bulkInsert(
      "parts",
      PARTS.map(({ id, name, sku, unit, stockQty }) => ({
        id,
        name,
        sku,
        unit,
        stock_qty: stockQty,
        created_at: seededAt,
        updated_at: seededAt,
      })),
      { transaction },
    );

    await queryInterface.bulkInsert(
      "request_parts",
      USAGE.map(([request, sku, quantity, date]) => ({
        request_id: `40000000-0000-4000-8000-0000000000${request}`,
        part_id: partBySku[sku],
        quantity,
        created_at: at(date),
        updated_at: at(date),
      })),
      { transaction },
    );
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const ids = PARTS.map((part) => part.id);
    await queryInterface.bulkDelete("request_parts", { part_id: ids }, { transaction });
    await queryInterface.bulkDelete("parts", { id: ids }, { transaction });
  });
}
