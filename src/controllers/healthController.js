// checkDatabase — проверка соединения с БД; без неё (в тестах) отвечаем только состоянием процесса
export function createHealthController({ checkDatabase } = {}) {
  return {
    async check(_req, res) {
      const data = {
        status: "ok",
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      };

      if (checkDatabase) {
        try {
          await checkDatabase();
          data.db = "ok";
        } catch {
          data.status = "degraded";
          data.db = "unavailable";
          res.status(503).json({ data });
          return;
        }
      }

      res.json({ data });
    },
  };
}
