import { sendList, sendCreated } from "./respond.js";

export function createTechniciansController({ technicianService }) {
  return {
    async list(req, res) {
      sendList(res, await technicianService.list(req.validated.query));
    },

    async getById(req, res) {
      res.json({ data: await technicianService.getById(req.validated.params.id) });
    },

    async create(req, res) {
      sendCreated(req, res, await technicianService.create(req.validated.body));
    },

    async update(req, res) {
      const { params, body } = req.validated;
      res.json({ data: await technicianService.update(params.id, body) });
    },

    async remove(req, res) {
      await technicianService.remove(req.validated.params.id);
      res.status(204).end();
    },
  };
}
