import { historyToItem } from "./serializers.js";

// Журнал статусов только пополняется: методов update и remove здесь нет намеренно,
// а на уровне БД их отклоняет триггер
export class HistoryRepository {
  constructor({ RequestStatusHistory }) {
    this.model = RequestStatusHistory;
  }

  async append(entry, { transaction } = {}) {
    return historyToItem(await this.model.create(entry, { transaction }));
  }

  async listByRequest(requestId, { transaction } = {}) {
    const rows = await this.model.findAll({
      where: { requestId },
      order: [["id", "ASC"]],
      transaction,
    });
    return rows.map(historyToItem);
  }
}
