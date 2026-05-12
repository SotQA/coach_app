/** @type {import('jest').Config} */
module.exports = {
  globals: {
    __DEV__: true,
  },
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testTimeout: 30000,
  moduleNameMapper: {
    "^.+/firebase/firebaseConfig$": "<rootDir>/tests/setup/firebaseTestConfig",
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tests/tsconfig.test.json",
        diagnostics: {
          ignoreCodes: [7016], // firebaseConfig.js has no type declarations — mocked at runtime anyway
        },
      },
    ],
  },
};
