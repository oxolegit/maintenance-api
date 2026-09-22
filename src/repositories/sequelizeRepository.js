import { buildWhere } from "./sequelize/where.js";

const SERVICE_FIELDS = new Set(["id", "createdAt", "updatedAt"]);

// Общий репозиторий поверх модели Sequelize. Интерфейс тот же, что был у хранилища
// в JSON-файлах: list/findById/findOne/count/create/update/remove. Каждый метод принимает
// { transaction, lock }, чтобы сервис мог объединить несколько операций в одну транзакцию.
// toRow/toItem переводят объект API в атрибуты модели и обратно
export class SequelizeRepository {
  constructor({ model, toRow = (data) => data, toItem = (row) => row.get({ plain: true }) }) {
    this.model = model;
    this.toRow = toRow;
    this.toItem = toItem;
  }

  // в запись попадают только атрибуты модели, служебные поля задаёт БД и ORM
  #attributes(data) {
    const row = this.toRow(data);
    return Object.fromEntries(
      Object.entries(row).filter(
        ([key]) => key in this.model.rawAttributes && !SERVICE_FIELDS.has(key),
      ),
    );
  }

  #lock(transaction, lock) {
    return lock && transaction ? transaction.LOCK.UPDATE : undefined;
  }

  async list(
    { filters = {}, sort = "createdAt", order = "desc", page = 1, limit = 20 } = {},
    { transaction } = {},
  ) {
    const { rows, count } = await this.model.findAndCountAll({
      where: buildWhere(this.model, filters),
      // NULLS LAST в обе стороны и id как стабильный добивочный ключ страницы
      order: [
        [sort, `${order.toUpperCase()} NULLS LAST`],
        ["id", "ASC"],
      ],
      limit,
      offset: (page - 1) * limit,
      transaction,
    });
    return { items: rows.map((row) => this.toItem(row)), total: count };
  }

  async findById(id, { transaction, lock } = {}) {
    const row = await this.model.findByPk(id, { transaction, lock: this.#lock(transaction, lock) });
    return row ? this.toItem(row) : null;
  }

  async findOne(filters, { transaction, lock } = {}) {
    const row = await this.model.findOne({
      where: buildWhere(this.model, filters),
      transaction,
      lock: this.#lock(transaction, lock),
    });
    return row ? this.toItem(row) : null;
  }

  async count(filters = {}, { transaction } = {}) {
    return this.model.count({ where: buildWhere(this.model, filters), transaction });
  }

  async create(data, { transaction } = {}) {
    const row = await this.model.create(this.#attributes(data), { transaction });
    return this.toItem(row);
  }

  async update(id, patch, { transaction } = {}) {
    const [count, rows] = await this.model.update(this.#attributes(patch), {
      where: { id },
      returning: true,
      transaction,
    });
    return count === 0 ? null : this.toItem(rows[0]);
  }

  async remove(id, { transaction } = {}) {
    const count = await this.model.destroy({ where: { id }, transaction });
    return count > 0;
  }
}
