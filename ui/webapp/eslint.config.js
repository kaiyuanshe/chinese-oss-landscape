import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import solidPlugin from 'eslint-plugin-solid';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          parserOpts: { plugins: ['typescript', 'jsx'] },
        },
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { solid: solidPlugin, 'simple-import-sort': simpleImportSort },
    rules: {
      ...js.configs.recommended.rules,
      ...solidPlugin.configs['flat/typescript'].rules,
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'solid/no-innerhtml': ['warn', { allowStatic: true }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    // TypeScript checks these core rules; Oxlint preserves the former TS recommended rules.
    rules: {
      'constructor-super': 'off',
      'getter-return': 'off',
      'no-class-assign': 'off',
      'no-const-assign': 'off',
      'no-dupe-args': 'off',
      'no-dupe-class-members': 'off',
      'no-dupe-keys': 'off',
      'no-func-assign': 'off',
      'no-import-assign': 'off',
      'no-new-native-nonconstructor': 'off',
      'no-obj-calls': 'off',
      'no-redeclare': 'off',
      'no-setter-return': 'off',
      'no-this-before-super': 'off',
      'no-undef': 'off',
      'no-unreachable': 'off',
      'no-unsafe-negation': 'off',
      'no-unused-vars': 'off',
      'no-array-constructor': 'off',
      'no-unused-expressions': 'off',
      'no-with': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
    },
  },
];
