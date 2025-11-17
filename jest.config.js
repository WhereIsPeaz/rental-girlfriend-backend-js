// jest.config.js
module.exports = {
  testMatch: ["**/tests/createUser.test.js"],
  collectCoverage: true,
  // measure coverage only from the test file (the file that will for sure be executed)
  collectCoverageFrom: ["<rootDir>/tests/createUser.test.js"],

  coverageReporters: ["text", "lcov"],
  coverageProvider: "v8"
};
