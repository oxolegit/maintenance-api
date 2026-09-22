export function createReportService({ reportRepository }) {
  const endOfDay = (date) => (date ? `${date}T23:59:59.999Z` : null);

  return {
    async equipmentLoad({ from, to, siteId, minRequests, sort, order, page, limit }) {
      const { items, total } = await reportRepository.equipmentLoad({
        from: from ?? null,
        to: endOfDay(to),
        siteId: siteId ?? null,
        minRequests,
        sort,
        order,
        page,
        limit,
      });
      return { items, total, page, limit };
    },
  };
}
