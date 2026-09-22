import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Umzug, SequelizeStorage } from "umzug";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const TEMPLATE = `export async function up({ context: queryInterface }) {}

export async function down({ context: queryInterface }) {}
`;

// Файлы миграций и сидов — ES-модули с функциями up/down; umzug сам умеет только require,
// поэтому загрузка описана явно (через file:// URL — иначе import не примет путь Windows)
function createRunner({ sequelize, logger, folder, tableName, modelName }) {
  const directory = path.join(ROOT, folder);

  return new Umzug({
    migrations: {
      glob: ["*.js", { cwd: directory }],
      resolve: ({ name, path: filepath, context }) => {
        const load = () => import(pathToFileURL(filepath).href);
        return {
          name,
          path: filepath,
          up: async () => (await load()).up({ name, context }),
          down: async () => (await load()).down({ name, context }),
        };
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName, modelName }),
    logger,
    create: { folder: directory, template: (filepath) => [[filepath, TEMPLATE]] },
  });
}

export function createMigrator({ sequelize, logger }) {
  return createRunner({
    sequelize,
    logger,
    folder: "migrations",
    tableName: "sequelize_meta",
    modelName: "SequelizeMeta",
  });
}

export function createSeeder({ sequelize, logger }) {
  return createRunner({
    sequelize,
    logger,
    folder: "seeders",
    tableName: "sequelize_seeds",
    modelName: "SequelizeSeed",
  });
}
