import { sendList, sendCreated } from "./respond.js";

export function createEquipmentController({ equipmentService }) {
  return {
    async list(req, res) {
      sendList(res, await equipmentService.list(req.validated.query));
    },

    async getById(req, res) {
      res.json({ data: await equipmentService.getById(req.validated.params.id) });
    },

    async create(req, res) {
      sendCreated(req, res, await equipmentService.create(req.validated.body));
    },

    async update(req, res) {
      const { params, body } = req.validated;
      res.json({ data: await equipmentService.update(params.id, body) });
    },

    async weather(req, res) {
      const { params, query } = req.validated;
      res.json({ data: await equipmentService.getWeather(params.id, query) });
    },

    async remove(req, res) {
      await equipmentService.remove(req.validated.params.id);
      res.status(204).end();
    },
  };
}
