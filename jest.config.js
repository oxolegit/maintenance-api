export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  // тесты ходят в общую базу DB_NAME_TEST, поэтому файлы выполняются последовательно
  globalSetup: "<rootDir>/tests/globalSetup.js",
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/setupDb.js"],
  maxWorkers: 1,
  testTimeout: 15000,
};
