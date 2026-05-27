import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.js"],
  testMatch: ["**/*.test.jsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
