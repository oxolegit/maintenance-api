import { AppError, BadRequestError, PayloadTooLargeError } from "../errors/index.js";
import { mapDbError } from "../db/errors.js";

const BODY_PARSER_ERRORS = {
  "entity.parse.failed": () =>
    new BadRequestError("Тело запроса не является корректным JSON", {
      code: "INVALID_JSON",
    }),
  "entity.too.large": () => new PayloadTooLargeError(),
};

function toAppError(error) {
  if (error instanceof AppError) {
    return error;
  }
  const bodyParserError = BODY_PARSER_ERRORS[error.type];
  if (bodyParserError) {
    return bodyParserError();
  }
  if (error.expose && error.status >= 400 && error.status < 500) {
    return new BadRequestError(error.message);
  }
  return mapDbError(error);
}

export function createErrorHandler({ logger, isProduction }) {
  return (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const appError = toAppError(error);
    const status = appError ? appError.status : 500;
    const requestId = req.id;

    if (status >= 500) {
      logger.error({ requestId, err: error }, "внутренняя ошибка при обработке запроса");
    } else {
      logger.warn({ requestId, status, code: appError.code }, appError.message);
    }

    const body = appError
      ? { code: appError.code, message: appError.message, details: appError.details }
      : { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" };

    if (!appError && !isProduction) {
      body.message = error.message || body.message;
      body.stack = error.stack;
    }

    res.status(status).json({ error: { ...body, requestId } });
  };
}
