import { createTestSequelize } from "./helpers/db.js";
import { createMigrator } from "../src/db/migrator.js";

// Один раз перед всеми тестами: схема тестовой базы приводится к актуальным миграциям
export default async function globalSetup() {
  const sequelize = createTestSequelize();
  try {
    await createMigrator({ sequelize }).up();
  } finally {
    await sequelize.close();
  }
}
