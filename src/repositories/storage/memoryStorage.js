export function createMemoryStorage(initial = {}) {
  return {
    async load(collection) {
      return structuredClone(initial[collection] ?? []);
    },
    async save() {},
  };
}
