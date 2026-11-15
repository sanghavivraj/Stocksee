// Backend (Node, CommonJS). The frontend has its own config (frontend/.eslintrc.cjs, root: true).
module.exports = {
  root: true,
  env: { node: true, es2022: true, jest: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
  ignorePatterns: ['frontend/', 'node_modules/', 'coverage/', 'prisma/migrations/'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  },
};
