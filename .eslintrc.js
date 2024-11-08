module.exports = {
  env: {
    browser: true,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ['@typescript-eslint'],
  extends: ['standard', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'node/no-missing-import': 'off',
    'no-unused-vars': 'warn',
  },
  ignorePatterns: [
    '*.md',
    'node_modules/',
    'coverage/',
    'artifacts/',
    'cache/',
    'typechain-types/',
  ],
};
