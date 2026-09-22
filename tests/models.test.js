import { createTestSequelize } from "./helpers/db.js";
import { createMigrator } from "../src/db/migrator.js";
import { defineModels } from "../src/db/models/index.js";

describe("модели Sequelize", () => {
  let sequelize;
  let models;

  beforeAll(async () => {
    sequelize = createTestSequelize();
    await createMigrator({ sequelize }).up();
    models = defineModels(sequelize);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("каждый атрибут каждой модели соответствует колонке в схеме", async () => {
    for (const model of Object.values(models)) {
      const columns = await sequelize.getQueryInterface().describeTable(model.getTableName());

      for (const attribute of Object.values(model.rawAttributes)) {
        const column = columns[attribute.field];
        expect({
          table: model.getTableName(),
          field: attribute.field,
          exists: Boolean(column),
        }).toEqual({ table: model.getTableName(), field: attribute.field, exists: true });
        expect({
          table: model.getTableName(),
          field: attribute.field,
          allowNull: column.allowNull,
        }).toEqual({
          table: model.getTableName(),
          field: attribute.field,
          allowNull: attribute.allowNull !== false && !attribute.primaryKey,
        });
      }
      expect(Object.keys(columns).sort()).toEqual(
        Object.values(model.rawAttributes)
          .map((attribute) => attribute.field)
          .sort(),
      );
    }
  });

  test("ассоциации описаны в обе стороны с ожидаемыми типами", () => {
    const { Site, Equipment, EquipmentPassport, MaintenanceRequest, Technician, RequestAssignee } =
      models;

    expect(Site.associations.equipment.associationType).toBe("HasMany");
    expect(Equipment.associations.site.associationType).toBe("BelongsTo");
    expect(Equipment.associations.passport.associationType).toBe("HasOne");
    expect(EquipmentPassport.associations.equipment.associationType).toBe("BelongsTo");
    expect(Equipment.associations.requests.associationType).toBe("HasMany");
    expect(MaintenanceRequest.associations.history.associationType).toBe("HasMany");
    expect(MaintenanceRequest.associations.technicians.associationType).toBe("BelongsToMany");
    expect(MaintenanceRequest.associations.technicians.through.model).toBe(RequestAssignee);
    expect(Technician.associations.requests.through.model).toBe(RequestAssignee);
  });

  test("числовые колонки возвращаются числами, специалисты удаляются мягко", async () => {
    const { Site, Technician } = models;
    const site = await Site.create({
      name: "Тестовая площадка",
      code: "TST",
      region: "Крым",
      latitude: 45.123456,
      longitude: 34.654321,
    });
    expect((await Site.findByPk(site.id)).latitude).toBe(45.123456);

    const technician = await Technician.create({
      fullName: "Иванов И. И.",
      specialization: "механик",
      employeeNumber: "E-100",
    });
    await technician.destroy();
    expect(await Technician.findByPk(technician.id)).toBeNull();
    expect(await Technician.findByPk(technician.id, { paranoid: false })).not.toBeNull();
    await expect(
      Technician.create({
        fullName: "Петров П. П.",
        specialization: "электрик",
        employeeNumber: "E-100",
      }),
    ).resolves.toBeDefined();

    await sequelize.query("TRUNCATE sites, technicians RESTART IDENTITY CASCADE");
  });
});
