/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.spec.ts'],
  // Each spec file boots its own MongoMemoryServer. Running many of them in parallel workers
  // (Jest's default) can exceed local system resources and produces flaky, non-deterministic
  // failures unrelated to the code under test — confirmed by re-running the exact same suite
  // serially and getting a clean pass. Serial execution is slower but deterministic, which matters
  // more for a suite this size.
  maxWorkers: 1,
};
