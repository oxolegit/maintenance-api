import { randomUUID } from "node:crypto";

function matchesCondition(value, condition) {
  if (condition === null || typeof condition !== "object") {
    return value === condition;
  }
  if (Array.isArray(condition.in) && !condition.in.includes(value)) return false;
  if (condition.gte !== undefined && !(value >= condition.gte)) return false;
  if (condition.lte !== undefined && !(value <= condition.lte)) return false;
  if (condition.gt !== undefined && !(value > condition.gt)) return false;
  if (condition.lt !== undefined && !(value < condition.lt)) return false;
  if (condition.contains !== undefined) {
    const haystack = String(value ?? "").toLowerCase();
    if (!haystack.includes(String(condition.contains).toLowerCase())) return false;
  }
  return true;
}

export function matchesFilters(item, filters = {}) {
  return Object.entries(filters).every(([field, condition]) => {
    if (condition === undefined) return true;
    if (field === "$or") {
      return condition.some((alternative) => matchesFilters(item, alternative));
    }
    return matchesCondition(item[field], condition);
  });
}

function compareBy(field, order) {
  const direction = order === "asc" ? 1 : -1;
  return (a, b) => {
    const left = a[field];
    const right = b[field];
    if (left === right) return 0;
    if (left === undefined || left === null) return 1;
    if (right === undefined || right === null) return -1;
    return (left > right ? 1 : -1) * direction;
  };
}

export class CollectionRepository {
  #items = [];

  constructor({ collection, storage }) {
    this.collection = collection;
    this.storage = storage;
  }

  async init() {
    this.#items = await this.storage.load(this.collection);
    return this;
  }

  async #persist() {
    await this.storage.save(this.collection, this.#items);
  }

  async list({ filters = {}, sort = "createdAt", order = "desc", page = 1, limit = 20 } = {}) {
    const matched = this.#items.filter((item) => matchesFilters(item, filters));
    matched.sort(compareBy(sort, order));
    const start = (page - 1) * limit;
    return {
      items: structuredClone(matched.slice(start, start + limit)),
      total: matched.length,
    };
  }

  async findById(id) {
    const item = this.#items.find((candidate) => candidate.id === id);
    return item ? structuredClone(item) : null;
  }

  async findOne(filters) {
    const item = this.#items.find((candidate) => matchesFilters(candidate, filters));
    return item ? structuredClone(item) : null;
  }

  async count(filters = {}) {
    return this.#items.filter((item) => matchesFilters(item, filters)).length;
  }

  async create(data) {
    const now = new Date().toISOString();
    const item = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    this.#items.push(item);
    await this.#persist();
    return structuredClone(item);
  }

  async update(id, patch) {
    const item = this.#items.find((candidate) => candidate.id === id);
    if (!item) {
      return null;
    }
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    await this.#persist();
    return structuredClone(item);
  }

  async remove(id) {
    const index = this.#items.findIndex((candidate) => candidate.id === id);
    if (index === -1) {
      return false;
    }
    this.#items.splice(index, 1);
    await this.#persist();
    return true;
  }
}
