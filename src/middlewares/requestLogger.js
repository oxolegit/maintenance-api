function levelFor(status) {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

export function createRequestLogger(logger) {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger[levelFor(res.statusCode)](
        {
          requestId: req.id,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 10) / 10,
        },
        "запрос обработан",
      );
    });

    next();
  };
}
