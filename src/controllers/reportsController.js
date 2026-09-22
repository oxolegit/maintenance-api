import { sendList } from "./respond.js";

export function createReportsController({ reportService }) {
  return {
    async equipmentLoad(req, res) {
      sendList(res, await reportService.equipmentLoad(req.validated.query));
    },
  };
}
