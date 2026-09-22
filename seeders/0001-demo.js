// Демонстрационные данные: три ветропарка Крыма, оборудование с паспортами, бригада специалистов
// и заявки во всех статусах с согласованным журналом и назначениями. Идентификаторы фиксированы,
// чтобы на них можно было ссылаться в README и коллекции Postman

const DAY = 24 * 60 * 60 * 1000;
const at = (date, hour = 9) => new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
const plus = (date, days) => new Date(date.getTime() + days * DAY);

// prettier-ignore
const SITES = [
  ["01", "Останинская ВЭС",  "OST", "Крым, Ленинский район",    45.3107, 35.7745],
  ["02", "Тарханкутская ВЭС", "TRH", "Крым, Черноморский район", 45.3462, 32.6521],
  ["03", "Донузлавская ВЭС",  "DNZ", "Крым, Сакский район",      45.3628, 33.0514],
].map(([n, name, code, region, latitude, longitude]) => ({
  id: `10000000-0000-4000-8000-0000000000${n}`,
  name,
  code,
  region,
  latitude,
  longitude,
}));

// [номер, площадка, название, тип, серийный номер, статус, широта, долгота, дата установки,
//  паспорт: производитель, модель, мощность кВт, дата поверки]
// prettier-ignore
const EQUIPMENT = [
  ["01", "OST", "Ветротурбина ВТ-01",  "turbine",    "WT-2024-001",  "operational",    45.3112, 35.7751, "2024-05-10", ["Vestas", "V90-2.0", 2000, "2026-04-15"]],
  ["02", "OST", "Ветротурбина ВТ-02",  "turbine",    "WT-2024-002",  "maintenance",    45.3134, 35.7802, "2024-05-12", ["Vestas", "V90-2.0", 2000, "2026-04-15"]],
  ["03", "OST", "Инвертор И-07",       "inverter",   "INV-2023-007", "operational",    45.3098, 35.7719, "2023-11-01", ["SMA", "Sunny Central 2200", 2200, "2025-12-02"]],
  ["04", "OST", "Подстанция ПС-1",     "substation", "SUB-2021-001", "operational",    45.3071, 35.7688, "2021-03-15", ["Siemens", "8DJH 36", 25000, "2025-09-20"]],
  ["05", "TRH", "Ветротурбина ТРХ-11", "turbine",    "WT-2022-011",  "fault",          45.3471, 32.6544, "2022-08-20", ["Enercon", "E-70 E4", 2300, "2026-02-10"]],
  ["06", "TRH", "Датчик ветра Д-3",    "sensor",     "SNS-2022-003", "operational",    45.3459, 32.6502, "2022-08-20", null],
  ["07", "DNZ", "Ветротурбина ДНЗ-04", "turbine",    "WT-2019-004",  "operational",    45.3633, 33.0527, "2019-06-30", ["Fuhrländer", "FL 2500", 2500, "2026-06-01"]],
  ["08", "DNZ", "Ветротурбина ДНЗ-09", "turbine",    "WT-2015-009",  "decommissioned", 45.3651, 33.0571, "2015-04-01", ["Fuhrländer", "FL 1500", 1500, "2023-03-14"]],
].map(([n, site, name, type, serialNumber, status, latitude, longitude, installedAt, passport]) => ({
  id: `20000000-0000-4000-8000-0000000000${n}`,
  site,
  name,
  type,
  serialNumber,
  status,
  latitude,
  longitude,
  installedAt,
  passport,
}));

// prettier-ignore
const TECHNICIANS = [
  ["01", "Кравченко Игорь Валентинович", "инженер по ВЭУ",           "T-101"],
  ["02", "Осипова Мария Сергеевна",      "электрик",                 "T-102"],
  ["03", "Бекиров Руслан Энверович",     "механик",                  "T-103"],
  ["04", "Литвиненко Павел Андреевич",   "промышленный альпинист",   "T-104"],
  ["05", "Гончарова Анна Викторовна",    "инженер КИПиА",            "T-105"],
  ["06", "Мустафаев Ленур Сейранович",   "электромонтёр подстанции", "T-106"],
].map(([n, fullName, specialization, employeeNumber]) => ({
  id: `30000000-0000-4000-8000-0000000000${n}`,
  fullName,
  specialization,
  employeeNumber,
}));

// [номер, серийный номер оборудования, тема, приоритет, статус, дата создания, плановая дата,
//  бригада: табельный номер, роль, плановые часы]
// prettier-ignore
const REQUESTS = [
  ["01", "WT-2024-001",  "Замена подшипника главного вала",                 "high",     "in_progress", "2026-09-10", "2026-10-05", [["T-103", "lead", 12], ["T-104", "member", 8]]],
  ["02", "WT-2024-001",  "Плановый осмотр гондолы",                         "low",      "new",         "2026-09-18", null,         []],
  ["03", "WT-2024-001",  "Проверка тормозной системы",                      "medium",   "done",        "2026-06-02", "2026-06-10", [["T-103", "lead", 6]]],
  ["04", "WT-2024-002",  "Балансировка ротора",                             "critical", "in_progress", "2026-09-14", "2026-09-28", [["T-101", "lead", 16], ["T-104", "member", 16], ["T-103", "member", 8]]],
  ["05", "WT-2024-002",  "Замена лопасти после удара молнии",               "critical", "done",        "2026-07-01", "2026-07-08", [["T-101", "lead", 40], ["T-104", "member", 40]]],
  ["06", "WT-2024-002",  "Смазка редуктора",                                "low",      "done",        "2026-08-11", "2026-08-15", [["T-103", "lead", 3]]],
  ["07", "INV-2023-007", "Проверка изоляции силовых кабелей",               "medium",   "new",         "2026-09-19", null,         []],
  ["08", "INV-2023-007", "Замена вентиляторов охлаждения",                  "high",     "done",        "2026-05-20", "2026-05-25", [["T-102", "lead", 5], ["T-105", "member", 2]]],
  ["09", "INV-2023-007", "Обновление прошивки контроллера",                 "low",      "rejected",    "2026-08-03", null,         []],
  ["10", "SUB-2021-001", "Осмотр трансформатора после грозы",               "medium",   "done",        "2026-07-15", "2026-07-16", [["T-106", "lead", 4], ["T-102", "member", 4]]],
  ["11", "SUB-2021-001", "Замена ограничителей перенапряжения",             "high",     "in_progress", "2026-09-16", "2026-09-30", [["T-106", "lead", 10]]],
  ["12", "SUB-2021-001", "Тепловизионный контроль контактов",               "low",      "new",         "2026-09-20", "2026-10-12", []],
  ["13", "WT-2022-011",  "Диагностика генератора после аварийного останова", "critical", "in_progress", "2026-09-12", "2026-09-22", [["T-101", "lead", 24], ["T-102", "member", 12]]],
  ["14", "WT-2022-011",  "Замена анемометра",                               "high",     "done",        "2026-04-08", "2026-04-12", [["T-105", "lead", 3], ["T-104", "member", 3]]],
  ["15", "WT-2022-011",  "Замена датчика вибрации",                         "medium",   "rejected",    "2026-06-20", null,         [["T-105", "lead", 2]]],
  ["16", "SNS-2022-003", "Калибровка датчика ветра",                        "medium",   "done",        "2026-08-25", "2026-08-27", [["T-105", "lead", 2]]],
  ["17", "SNS-2022-003", "Замена кабеля связи",                             "low",      "new",         "2026-09-21", null,         []],
  ["18", "WT-2019-004",  "Регламентное ТО-2",                               "medium",   "done",        "2026-03-10", "2026-03-20", [["T-103", "lead", 20], ["T-104", "member", 20], ["T-102", "member", 6]]],
  ["19", "WT-2019-004",  "Замена масла в гидросистеме",                     "medium",   "done",        "2026-06-25", "2026-06-30", [["T-103", "lead", 6]]],
  ["20", "WT-2019-004",  "Устранение течи гидравлики",                      "high",     "in_progress", "2026-09-17", "2026-09-24", [["T-103", "lead", 8], ["T-104", "member", 4]]],
  ["21", "WT-2019-004",  "Проверка системы поворота гондолы",               "low",      "new",         "2026-09-21", "2026-10-20", []],
  ["22", "WT-2019-004",  "Покраска башни",                                  "low",      "rejected",    "2026-05-05", null,         []],
  ["23", "WT-2015-009",  "Демонтаж лопастей",                               "medium",   "done",        "2026-02-01", "2026-02-15", [["T-101", "lead", 32], ["T-104", "member", 32]]],
  ["24", "WT-2015-009",  "Вывоз гондолы",                                   "low",      "done",        "2026-03-01", "2026-03-05", [["T-101", "lead", 8]]],
].map(([n, serialNumber, title, priority, status, createdAt, plannedAt, assignees]) => ({
  id: `40000000-0000-4000-8000-0000000000${n}`,
  serialNumber,
  title,
  priority,
  status,
  createdAt: at(createdAt),
  plannedAt: plannedAt ? at(plannedAt, 8) : null,
  assignees,
}));

// Путь заявки по статусам: строки журнала выводятся из конечного статуса
function historyFor(request) {
  const steps = [
    { previousStatus: null, newStatus: "new", changedAt: request.createdAt, author: "dispatcher" },
  ];
  const started = plus(request.createdAt, 1);
  if (request.status === "in_progress" || request.status === "done") {
    steps.push({
      previousStatus: "new",
      newStatus: "in_progress",
      changedAt: started,
      author: "dispatcher",
    });
  }
  if (request.status === "done") {
    steps.push({
      previousStatus: "in_progress",
      newStatus: "done",
      changedAt: plus(started, 3),
      author: "brigade",
      comment: "работы выполнены, оборудование проверено",
    });
  }
  if (request.status === "rejected") {
    steps.push({
      previousStatus: "new",
      newStatus: "rejected",
      changedAt: plus(request.createdAt, 2),
      author: "chief-engineer",
      comment: "работы не требуются",
    });
  }
  return steps;
}

export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const siteByCode = Object.fromEntries(SITES.map((site) => [site.code, site.id]));
    const equipmentBySerial = Object.fromEntries(
      EQUIPMENT.map((item) => [item.serialNumber, item]),
    );
    const technicianByNumber = Object.fromEntries(
      TECHNICIANS.map((technician) => [technician.employeeNumber, technician.id]),
    );
    const stamp = (row, date) => ({ ...row, created_at: date, updated_at: date });
    const seededAt = at("2026-01-10");

    await queryInterface.bulkInsert(
      "sites",
      SITES.map(({ id, name, code, region, latitude, longitude }) =>
        stamp({ id, name, code, region, latitude, longitude }, seededAt),
      ),
      { transaction },
    );

    await queryInterface.bulkInsert(
      "equipment",
      EQUIPMENT.map((item) =>
        stamp(
          {
            id: item.id,
            site_id: siteByCode[item.site],
            name: item.name,
            type: item.type,
            serial_number: item.serialNumber,
            status: item.status,
            latitude: item.latitude,
            longitude: item.longitude,
            installed_at: item.installedAt,
          },
          seededAt,
        ),
      ),
      { transaction },
    );

    await queryInterface.bulkInsert(
      "equipment_passports",
      EQUIPMENT.filter((item) => item.passport).map((item, index) =>
        stamp(
          {
            id: `21000000-0000-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`,
            equipment_id: item.id,
            manufacturer: item.passport[0],
            model: item.passport[1],
            rated_power_kw: item.passport[2],
            last_inspection_at: item.passport[3],
          },
          seededAt,
        ),
      ),
      { transaction },
    );

    await queryInterface.bulkInsert(
      "technicians",
      TECHNICIANS.map(({ id, fullName, specialization, employeeNumber }) =>
        stamp(
          { id, full_name: fullName, specialization, employee_number: employeeNumber },
          seededAt,
        ),
      ),
      { transaction },
    );

    const history = [];
    const assignees = [];
    const requests = REQUESTS.map((request) => {
      const steps = historyFor(request);
      history.push(
        ...steps.map((step) => ({
          request_id: request.id,
          previous_status: step.previousStatus,
          new_status: step.newStatus,
          author: step.author,
          comment: step.comment ?? null,
          changed_at: step.changedAt,
        })),
      );
      assignees.push(
        ...request.assignees.map(([employeeNumber, role, hours]) => ({
          request_id: request.id,
          technician_id: technicianByNumber[employeeNumber],
          role,
          hours,
          created_at: plus(request.createdAt, 1),
        })),
      );
      return {
        id: request.id,
        equipment_id: equipmentBySerial[request.serialNumber].id,
        title: request.title,
        description: "",
        priority: request.priority,
        status: request.status,
        planned_at: request.plannedAt,
        author: "dispatcher",
        created_at: request.createdAt,
        updated_at: steps.at(-1).changedAt,
      };
    });

    await queryInterface.bulkInsert("maintenance_requests", requests, { transaction });
    await queryInterface.bulkInsert("request_status_history", history, { transaction });
    await queryInterface.bulkInsert("request_assignees", assignees, { transaction });
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const ids = (rows) => rows.map((row) => row.id);
    // журнал и назначения уходят каскадом вместе с заявками, паспорта — вместе с оборудованием
    await queryInterface.bulkDelete("maintenance_requests", { id: ids(REQUESTS) }, { transaction });
    await queryInterface.bulkDelete("equipment", { id: ids(EQUIPMENT) }, { transaction });
    await queryInterface.bulkDelete("sites", { id: ids(SITES) }, { transaction });
    await queryInterface.bulkDelete("technicians", { id: ids(TECHNICIANS) }, { transaction });
  });
}
