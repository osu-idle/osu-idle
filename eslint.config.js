import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'**/dist/**',
			'**/node_modules/**',
			'packages/client/public/**',
			'packages/client/osu!design/**',
			'packages/server/drizzle/**',
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
		},
		rules: {
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/semi': 'error',
			'no-tabs': 'off',
		},
	},
);
