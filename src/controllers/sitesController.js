import { sendList, sendCreated } from "./respond.js";

export function createSitesController({ siteService, equipmentService }) {
  return {
    async list(req, res) {
      sendList(res, await siteService.list(req.validated.query));
    },

    async getById(req, res) {
      res.json({ data: await siteService.getById(req.validated.params.id) });
    },

    async create(req, res) {
      sendCreated(req, res, await siteService.create(req.validated.body));
    },

    async update(req, res) {
      const { params, body } = req.validated;
      res.json({ data: await siteService.update(params.id, body) });
    },

    async remove(req, res) {
      await siteService.remove(req.validated.params.id);
      res.status(204).end();
    },

    async summary(req, res) {
      const { params, query } = req.validated;
      res.json({ data: await siteService.summary(params.id, query) });
    },

    // вложенный ресурс: оборудование площадки тем же списком, что и /api/equipment
    async listEquipment(req, res) {
      const { params, query } = req.validated;
      await siteService.getById(params.id);
      sendList(res, await equipmentService.list({ ...query, siteId: params.id }));
    },
  };
}
