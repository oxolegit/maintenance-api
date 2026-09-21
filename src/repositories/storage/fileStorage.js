import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";

export function createFileStorage({ dataDir }) {
  const writeQueues = new Map();

  function filePath(collection) {
    return path.join(dataDir, `${collection}.json`);
  }

  async function writeAtomically(collection, items) {
    await mkdir(dataDir, { recursive: true });
    const target = filePath(collection);
    const temp = `${target}.tmp`;
    await writeFile(temp, JSON.stringify(items, null, 2), "utf-8");
    await rename(temp, target);
  }

  return {
    async load(collection) {
      try {
        const content = await readFile(filePath(collection), "utf-8");
        return JSON.parse(content);
      } catch (error) {
        if (error.code === "ENOENT") {
          return [];
        }
        throw error;
      }
    },

    save(collection, items) {
      const snapshot = structuredClone(items);
      const previous = writeQueues.get(collection) ?? Promise.resolve();
      const next = previous.catch(() => {}).then(() => writeAtomically(collection, snapshot));
      writeQueues.set(collection, next);
      return next;
    },
  };
}
