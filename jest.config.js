/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Timing tests (*.perf.test.ts) run separately and serially: `npm run test:perf`.
  testPathIgnorePatterns: process.env.PERF_TESTS
    ? ['/node_modules/', '/e2e/', '/dist/']
    : ['/node_modules/', '/e2e/', '/dist/', '\\.perf\\.test\\.ts$'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
