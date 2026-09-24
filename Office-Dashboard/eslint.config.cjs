const parser = require('@typescript-eslint/parser');

// TypeScript's strict compiler handles types and undefined identifiers.
// These checks catch control-flow and expression mistakes without rewriting
// the legacy application's formatting or imposing an unrelated style migration.
module.exports = [{
  files: ['src/**/*.ts', 'tests/**/*.ts'],
  languageOptions: { parser, ecmaVersion: 2022, sourceType: 'module' },
  rules: {
    'constructor-super': 'error',
    'for-direction': 'error',
    'no-async-promise-executor': 'error',
    'no-compare-neg-zero': 'error',
    'no-cond-assign': ['error', 'always'],
    'no-debugger': 'error',
    'no-dupe-args': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-fallthrough': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
  },
}];
