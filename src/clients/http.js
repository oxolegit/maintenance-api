import { HttpError, NetworkError, TimeoutError, InvalidJsonError } from "./errors.js";

export async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { method: "GET", signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new TimeoutError(url.toString());
    }
    throw new NetworkError(url.toString(), error);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new HttpError(response.status, url.toString());
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidJsonError(url.toString());
  }
}
