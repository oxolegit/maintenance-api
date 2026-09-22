import { Op } from "sequelize";
import { SequelizeRepository } from "./sequelizeRepository.js";
import { partToItem, requestPartToItem } from "./serializers.js";

export class PartRepository extends SequelizeRepository {
  constructor({ Part }) {
    super({ model: Part, toItem: partToItem });
  }

  // Условное списание: остаток уменьшается только если его хватает, иначе ни одна строка
  // не затрагивается — так две параллельные транзакции не уведут склад в минус
  async withdraw(partId, quantity, { transaction }) {
    const [[rows, affected]] = await this.model.decrement(
      { stockQty: quantity },
      { where: { id: partId, stockQty: { [Op.gte]: quantity } }, transaction },
    );
    return affected === 0 ? null : this.toItem(rows[0]);
  }

  async restock(partId, quantity, { transaction }) {
    const [[rows]] = await this.model.increment(
      { stockQty: quantity },
      { where: { id: partId }, transaction },
    );
    return rows[0] ? this.toItem(rows[0]) : null;
  }
}

export class RequestPartRepository {
  constructor({ RequestPart, Part }) {
    this.model = RequestPart;
    this.partInclude = { association: "part", model: Part };
  }

  async listByRequest(requestId, { transaction } = {}) {
    const rows = await this.model.findAll({
      where: { requestId },
      include: [this.partInclude],
      order: [["createdAt", "ASC"]],
      transaction,
    });
    return rows.map(requestPartToItem);
  }

  async add(requestId, partId, quantity, { transaction }) {
    const [row, created] = await this.model.findOrCreate({
      where: { requestId, partId },
      defaults: { quantity },
      transaction,
    });
    if (!created) {
      await row.increment({ quantity }, { transaction });
    }
  }

  async find(requestId, partId, { transaction } = {}) {
    const row = await this.model.findOne({ where: { requestId, partId }, transaction });
    return row ? requestPartToItem(row) : null;
  }

  async remove(requestId, partId, { transaction }) {
    return (await this.model.destroy({ where: { requestId, partId }, transaction })) > 0;
  }

  async countByPart(partId, { transaction } = {}) {
    return this.model.count({ where: { partId }, transaction });
  }
}
