const parser = require('@typescript-eslint/parser');
const hooks = require('eslint-plugin-react-hooks');
const backend = require('../eslint.config.cjs');

module.exports = [{
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: {
    parser, ecmaVersion: 2022, sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { 'react-hooks': hooks },
  rules: { ...backend[0].rules, 'react-hooks/rules-of-hooks': 'error' },
}];
