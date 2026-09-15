export function createHealthController() {
  return {
    check(_req, res) {
      res.json({
        data: {
          status: "ok",
          uptime: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      });
    },
  };
}
