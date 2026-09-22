import { NotFoundError, ConflictError } from "../errors/index.js";

function buildFilters({ region, q }) {
  const filters = { region: region ? { contains: region } : undefined };
  if (q) {
    filters.$or = [{ name: { contains: q } }, { code: { contains: q } }];
  }
  return filters;
}

const endOfDay = (date) => (date ? `${date}T23:59:59.999Z` : null);

export function createSiteService({ siteRepository, equipmentRepository }) {
  async function getById(id) {
    const site = await siteRepository.findById(id);
    if (!site) {
      throw new NotFoundError(`Площадка ${id} не найдена`, { code: "SITE_NOT_FOUND" });
    }
    return site;
  }

  return {
    async list({ page, limit, sort, order, ...filterParams }) {
      const { items, total } = await siteRepository.list({
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
      return siteRepository.create(data);
    },

    async update(id, patch) {
      await getById(id);
      return siteRepository.update(id, patch);
    },

    async remove(id) {
      await getById(id);
      const equipmentCount = await equipmentRepository.count({ siteId: id });
      if (equipmentCount > 0) {
        throw new ConflictError(
          `Нельзя удалить площадку: на ней числится оборудование (${equipmentCount})`,
          { code: "SITE_HAS_EQUIPMENT" },
        );
      }
      await siteRepository.remove(id);
    },

    async summary(id, { from, to } = {}) {
      const site = await getById(id);
      const summary = await siteRepository.summary(id, { from: from ?? null, to: endOfDay(to) });
      return {
        siteId: site.id,
        siteName: site.name,
        period: { from: from ?? null, to: to ?? null },
        ...summary,
      };
    },
  };
}
