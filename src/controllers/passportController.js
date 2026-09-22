export function createPassportController({ passportService }) {
  return {
    async get(req, res) {
      res.json({ data: await passportService.getByEquipment(req.validated.params.id) });
    },

    // 201 при первом заполнении паспорта, 200 при замене
    async put(req, res) {
      const { params, body } = req.validated;
      const { passport, created } = await passportService.put(params.id, body);
      res.status(created ? 201 : 200).json({ data: passport });
    },

    async remove(req, res) {
      await passportService.remove(req.validated.params.id);
      res.status(204).end();
    },
  };
}
