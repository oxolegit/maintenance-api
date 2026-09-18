import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFileStorage } from "../src/repositories/storage/fileStorage.js";
import { createMemoryStorage } from "../src/repositories/storage/memoryStorage.js";
import { CollectionRepository, matchesFilters } from "../src/repositories/collectionRepository.js";

describe("CollectionRepository", () => {
  let repo;

  beforeEach(async () => {
    repo = await new CollectionRepository({
      collection: "items",
      storage: createMemoryStorage(),
    }).init();
  });

  test("create проставляет id, createdAt и updatedAt", async () => {
    const item = await repo.create({ name: "a" });

    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.createdAt).toBe(item.updatedAt);
  });

  test("list фильтрует, сортирует и режет страницы", async () => {
    await repo.create({ name: "b", score: 2 });
    await repo.create({ name: "a", score: 1 });
    await repo.create({ name: "c", score: 3 });

    const result = await repo.list({
      filters: { score: { gte: 2 } },
      sort: "name",
      order: "asc",
      page: 1,
      limit: 1,
    });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.name)).toEqual(["b"]);
  });

  test("возвращаемые объекты изолированы от внутреннего состояния", async () => {
    const created = await repo.create({ name: "a" });
    created.name = "изменено снаружи";

    expect((await repo.findById(created.id)).name).toBe("a");
  });

  test("update и remove возвращают null/false для несуществующего id", async () => {
    expect(await repo.update("missing", { name: "x" })).toBeNull();
    expect(await repo.remove("missing")).toBe(false);
  });
});

describe("matchesFilters", () => {
  const item = { status: "new", title: "Замена лопасти", createdAt: "2026-09-10T00:00:00Z" };

  test("поддерживает равенство, диапазоны, вхождение в список, подстроку и $or", () => {
    expect(matchesFilters(item, { status: "new" })).toBe(true);
    expect(matchesFilters(item, { status: "done" })).toBe(false);
    expect(matchesFilters(item, { status: { in: ["new", "done"] } })).toBe(true);
    expect(matchesFilters(item, { createdAt: { gte: "2026-09-01", lte: "2026-09-30" } })).toBe(
      true,
    );
    expect(matchesFilters(item, { createdAt: { gte: "2026-09-11" } })).toBe(false);
    expect(matchesFilters(item, { title: { contains: "лопаст" } })).toBe(true);
    expect(matchesFilters(item, { $or: [{ status: "done" }, { status: "new" }] })).toBe(true);
    expect(matchesFilters(item, { status: undefined })).toBe(true);
  });
});

describe("файловое хранилище", () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "maintenance-api-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("сохраняет коллекцию в JSON и загружает её при следующем старте", async () => {
    const storage = createFileStorage({ dataDir: dir });
    const first = await new CollectionRepository({ collection: "items", storage }).init();
    const created = await first.create({ name: "a" });
    await first.update(created.id, { name: "b" });

    const raw = JSON.parse(await readFile(path.join(dir, "items.json"), "utf-8"));
    expect(raw).toHaveLength(1);
    expect(raw[0].name).toBe("b");

    const second = await new CollectionRepository({ collection: "items", storage }).init();
    expect(await second.findById(created.id)).toMatchObject({ name: "b" });
  });

  test("отсутствующий файл трактуется как пустая коллекция", async () => {
    const storage = createFileStorage({ dataDir: path.join(dir, "nested") });
    const repo = await new CollectionRepository({ collection: "items", storage }).init();

    expect(await repo.list()).toEqual({ items: [], total: 0 });
  });
});
