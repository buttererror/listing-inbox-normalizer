module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  maxWorkers: 1,
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'NodeNext', moduleResolution: 'NodeNext', isolatedModules: true } }] },
};
