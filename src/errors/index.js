export class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL_ERROR", details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Некорректный запрос", { code = "BAD_REQUEST", details } = {}) {
    super(message, { status: 400, code, details });
  }
}

export class ValidationError extends AppError {
  constructor(details, { message = "Некорректные данные запроса", status = 422 } = {}) {
    super(message, { status, code: "VALIDATION_ERROR", details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Требуется API-ключ") {
    super(message, { status: 401, code: "UNAUTHORIZED" });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Ресурс не найден", { code = "NOT_FOUND", details } = {}) {
    super(message, { status: 404, code, details });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Конфликт данных", { code = "CONFLICT", details } = {}) {
    super(message, { status: 409, code, details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Слишком большое тело запроса") {
    super(message, { status: 413, code: "PAYLOAD_TOO_LARGE" });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Слишком много запросов, повторите позже") {
    super(message, { status: 429, code: "RATE_LIMITED" });
  }
}

export class UpstreamError extends AppError {
  constructor(message = "Внешний сервис недоступен", { timeout = false } = {}) {
    super(message, {
      status: timeout ? 504 : 502,
      code: timeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
    });
  }
}
