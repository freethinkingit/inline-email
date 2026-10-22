import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const exportedClass = 'ExportNamedDeclaration > ClassDeclaration';

const exportedFunctions = [
  'ExportNamedDeclaration > FunctionDeclaration',
  'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
  'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression',
  `${exportedClass} MethodDefinition[accessibility!="private"][key.type!="PrivateIdentifier"] > FunctionExpression`
];

const declaredExportsOnly = 'Use a named, declared export (export function name …) so the JSDoc rules can check it.';

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'examples/out', 'test-results']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }]
    }
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['src/**/*.ts'],
    plugins: { jsdoc },
    rules: {
      'no-restricted-syntax': ['error',
        { selector: 'ExportDefaultDeclaration', message: declaredExportsOnly },
        { selector: 'ExportNamedDeclaration[declaration=null][source=null]', message: declaredExportsOnly }
      ],
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: { esm: true },
        require: {
          ArrowFunctionExpression: true,
          ClassDeclaration: true,
          FunctionDeclaration: true,
          FunctionExpression: true,
          MethodDefinition: true
        }
      }],
      'jsdoc/require-description': ['error', { contexts: [...exportedFunctions, exportedClass] }],
      'jsdoc/require-param': ['error', { contexts: exportedFunctions }],
      'jsdoc/require-param-description': ['error', { contexts: exportedFunctions }],
      'jsdoc/require-returns': ['error', { contexts: exportedFunctions }],
      'jsdoc/require-returns-description': ['error', { contexts: exportedFunctions }],
      'jsdoc/require-throws': ['error', { contexts: exportedFunctions }],
      'jsdoc/require-rejects': ['error', { contexts: exportedFunctions }]
    }
  }
);
