import { sendList, sendCreated } from "./respond.js";

export function createRequestsController({ requestService }) {
  return {
    async list(req, res) {
      sendList(res, await requestService.list(req.validated.query));
    },

    async listByEquipment(req, res) {
      const { params, query } = req.validated;
      sendList(res, await requestService.listByEquipment(params.id, query));
    },

    async getById(req, res) {
      res.json({ data: await requestService.getById(req.validated.params.id) });
    },

    async create(req, res) {
      sendCreated(req, res, await requestService.create(req.validated.body));
    },

    async importMany(req, res) {
      res.status(207).json({ data: await requestService.importMany(req.validated.body.items) });
    },

    async update(req, res) {
      const { params, body } = req.validated;
      res.json({ data: await requestService.update(params.id, body) });
    },

    async changeStatus(req, res) {
      const { params, body } = req.validated;
      res.json({ data: await requestService.changeStatus(params.id, body) });
    },

    async history(req, res) {
      res.json({ data: await requestService.history(req.validated.params.id) });
    },

    async remove(req, res) {
      await requestService.remove(req.validated.params.id);
      res.status(204).end();
    },
  };
}
