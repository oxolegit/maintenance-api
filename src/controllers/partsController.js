import { sendList, sendCreated } from "./respond.js";

export function createPartsController({ partService }) {
  return {
    async list(req, res) {
      sendList(res, await partService.list(req.validated.query));
    },

    async getById(req, res) {
      res.json({ data: await partService.getById(req.validated.params.id) });
    },

    async create(req, res) {
      sendCreated(req, res, await partService.create(req.validated.body));
    },

    async update(req, res) {
      const { params, body } = req.validated;
      res.json({ data: await partService.update(params.id, body) });
    },

    async remove(req, res) {
      await partService.remove(req.validated.params.id);
      res.status(204).end();
    },

    async listByRequest(req, res) {
      res.json({ data: await partService.listByRequest(req.validated.params.id) });
    },

    // 201: позиции списаны все разом, иначе ни одной (409 и откат)
    async writeOff(req, res) {
      const { params, body } = req.validated;
      res.status(201).json({ data: await partService.writeOff(params.id, body.items) });
    },

    async returnToStock(req, res) {
      const { id, partId } = req.validated.params;
      await partService.returnToStock(id, partId);
      res.status(204).end();
    },
  };
}
