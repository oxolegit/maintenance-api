export class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class HttpError extends ClientError {
  constructor(status, url) {
    super(`ответ со статусом ${status} (${url})`);
    this.status = status;
  }
}

export class NetworkError extends ClientError {
  constructor(url, cause) {
    super(`сеть недоступна: ${url}`);
    this.cause = cause;
  }
}

export class TimeoutError extends ClientError {
  constructor(url) {
    super(`превышен таймаут запроса: ${url}`);
  }
}

export class InvalidJsonError extends ClientError {
  constructor(url) {
    super(`некорректный JSON в ответе: ${url}`);
  }
}
