import { Sequelize } from "sequelize";

// Единственная точка создания подключения: server.js, CLI-скрипты и тесты получают
// экземпляр отсюда и сами отвечают за его закрытие
export function createSequelize({ db, logger }) {
  return new Sequelize(db.name, db.user, db.password, {
    dialect: "postgres",
    host: db.host,
    port: db.port,
    pool: { min: db.pool.min, max: db.pool.max, acquire: 30000, idle: 10000 },
    define: { underscored: true, timestamps: true },
    // все даты храним и сравниваем в UTC, смещение задаётся на каждое соединение
    timezone: "+00:00",
    benchmark: true,
    logging: db.logSql && logger ? (sql, ms) => logger.debug({ sql, ms }, "sql") : false,
  });
}

export async function pingDatabase(sequelize) {
  await sequelize.query("SELECT 1");
}
