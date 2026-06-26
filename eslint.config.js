import stylistic from '@stylistic/eslint-plugin';
import importNewlines from 'eslint-plugin-import-newlines';
import tseslint from 'typescript-eslint';

// Lines exempt from max-len: a lone <Trans>, a `t` i18n template, single string
// declarations, and pure prose/JSX-text lines (the interior of a multiline
// <Trans> - matched by shape since max-len can't see across lines). All of it
// untranslatable text we can't reflow anyway.
const maxLenIgnore = [
	'^\\t*<Trans>.*</Trans>$',
	't`.*`,?$',
	'`.*`,?$',
	'^\\t*(?:const|let|var) \\w+ = ([`\'"]).*\\1;?$',
	'^\\t*[^{}();=]*[A-Za-z][^{}();=]*$',
	'.*InferResponseType.*',
	'.*throw new.*',
	'^\\t*return `.*`;$',
].join('|');

export default tseslint.config(
	{
		ignores: [
			'**/dist/**',
			'**/node_modules/**',
			'**/out/**',
			'**/build/**',
			'**/release/**',
			'**/coverage/**',
			'**/*.min.js',
			'packages/client/public/**',
			'packages/client/osu!design/**',
			'packages/server/drizzle/**',
			'packages/shared/src/locales/*.ts',
		],
	},
	...tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				// One config for the whole monorepo; pin the root so the parser
				// doesn't have to guess between candidate package roots.
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			'@stylistic': stylistic,
			'import-newlines': importNewlines,
		},
		rules: {
			'import-newlines/enforce': ['error', { items: 1 }],
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/semi': 'error',
			'@stylistic/quotes': ['error', 'single'],
			'@stylistic/max-len': ['error', {
				'code': 100,
				'tabWidth': 0,
				'ignorePattern': maxLenIgnore,
				'ignoreComments': true,
				'ignoreUrls': true,
			}],
			'no-tabs': 'off',
			'complexity': ['error', { 'max': 14 }],
			'comma-dangle': ['error', 'always-multiline'],
			'object-curly-spacing': ['error', 'always'],
			'object-curly-newline': [
				'error',
				{
					ObjectExpression: {
						multiline: true,
						minProperties: 2,
					},
				},
			],
		},
	},
);
