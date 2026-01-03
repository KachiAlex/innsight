import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/testHooks.ts'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.ts',
  testTimeout: 60000,
  moduleNameMapper: {
    '^firebase-admin$': '<rootDir>/tests/mocks/firebase-admin.ts',
  },
  reporters: ['default'],
  clearMocks: true,
  maxWorkers: 1,
  verbose: true,
  detectOpenHandles: false,
  collectCoverage: false,
};

export default config;
