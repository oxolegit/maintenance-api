import { truncateAll, closeTestDb } from "./db.js";

// Подключается к каждому файлу тестов: чистая база перед каждым тестом, закрытое соединение после файла
beforeEach(truncateAll);
afterAll(closeTestDb);
