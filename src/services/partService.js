import { NotFoundError, ConflictError } from "../errors/index.js";
import { OPEN_REQUEST_STATUSES } from "../models/request.js";

function buildFilters({ q, inStock }) {
  const filters = {};
  if (q) {
    filters.$or = [{ name: { contains: q } }, { sku: { contains: q } }];
  }
  if (inStock !== undefined) {
    filters.stockQty = inStock ? { gt: 0 } : 0;
  }
  return filters;
}

export function createPartService({
  partRepository,
  requestPartRepository,
  requestRepository,
  transaction,
}) {
  async function getById(id, options) {
    const part = await partRepository.findById(id, options);
    if (!part) {
      throw new NotFoundError(`Запчасть ${id} не найдена`, { code: "PART_NOT_FOUND" });
    }
    return part;
  }

  async function lockOpenRequest(requestId, options) {
    const request = await requestRepository.findById(requestId, { ...options, lock: true });
    if (!request) {
      throw new NotFoundError(`Заявка ${requestId} не найдена`);
    }
    if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
      throw new ConflictError(`Заявка в статусе ${request.status} закрыта для списания`, {
        code: "REQUEST_CLOSED",
      });
    }
    return request;
  }

  return {
    async list({ page, limit, sort, order, ...filterParams }) {
      const { items, total } = await partRepository.list({
        filters: buildFilters(filterParams),
        sort,
        order,
        page,
        limit,
      });
      return { items, total, page, limit };
    },

    getById,

    create(data) {
      return partRepository.create(data);
    },

    async update(id, patch) {
      await getById(id);
      return partRepository.update(id, patch);
    },

    async remove(id) {
      await getById(id);
      if ((await requestPartRepository.countByPart(id)) > 0) {
        throw new ConflictError("Нельзя удалить запчасть: по ней есть списания на заявки", {
          code: "PART_IN_USE",
        });
      }
      await partRepository.remove(id);
    },

    async listByRequest(requestId) {
      if (!(await requestRepository.findById(requestId))) {
        throw new NotFoundError(`Заявка ${requestId} не найдена`);
      }
      return requestPartRepository.listByRequest(requestId);
    },

    // Списание — одна транзакция: заявка блокируется, позиции обрабатываются в порядке partId
    // (одинаковый порядок блокировок в параллельных транзакциях исключает взаимную блокировку),
    // остаток уменьшается условным UPDATE. Нехватка любой позиции откатывает все предыдущие
    writeOff(requestId, items) {
      return transaction(async (t) => {
        const options = { transaction: t };
        await lockOpenRequest(requestId, options);

        const ordered = [...items].sort((a, b) => a.partId.localeCompare(b.partId));
        for (const { partId, quantity } of ordered) {
          const part = await getById(partId, options);
          const withdrawn = await partRepository.withdraw(partId, quantity, options);
          if (!withdrawn) {
            throw new ConflictError(`Недостаточно остатка запчасти ${part.name}`, {
              code: "INSUFFICIENT_STOCK",
              details: [
                {
                  field: "items",
                  message: `${part.sku}: запрошено ${quantity}, на складе ${part.stockQty}`,
                },
              ],
            });
          }
          await requestPartRepository.add(requestId, partId, quantity, options);
        }
        return requestPartRepository.listByRequest(requestId, options);
      });
    },

    // Возврат: позиция снимается с заявки, количество возвращается на склад
    returnToStock(requestId, partId) {
      return transaction(async (t) => {
        const options = { transaction: t };
        await lockOpenRequest(requestId, options);
        const usage = await requestPartRepository.find(requestId, partId, options);
        if (!usage) {
          throw new NotFoundError(`Запчасть ${partId} не списана на заявку`, {
            code: "REQUEST_PART_NOT_FOUND",
          });
        }
        await requestPartRepository.remove(requestId, partId, options);
        await partRepository.restock(partId, usage.quantity, options);
      });
    },
  };
}
