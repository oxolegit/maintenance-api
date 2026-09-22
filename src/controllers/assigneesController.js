export function createAssigneesController({ assigneeService }) {
  return {
    async list(req, res) {
      res.json({ data: await assigneeService.list(req.validated.params.id) });
    },

    async assign(req, res) {
      const { params, body } = req.validated;
      res.json({ data: await assigneeService.assign(params.id, body.assignees) });
    },

    async remove(req, res) {
      const { id, technicianId } = req.validated.params;
      await assigneeService.remove(id, technicianId);
      res.status(204).end();
    },
  };
}
