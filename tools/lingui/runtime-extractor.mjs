// Custom Lingui extractor for packages that can't run the Babel macros (shared,
// built with tsc; server, run with tsx). It collects the source strings passed
// to the runtime helpers in @osu-idle/shared/i18n/translate:
//
//   __('Some text'[, 'context'])                -> one message
//   defineMessages({ key: 'Some text', ... })   -> one message per literal value
//                 ({ key: ['a', 'b'], ... })     -> one message per array literal
//
// Ids are derived with the same hash the frontend macros use, so a given source
// string maps to one catalog entry across every package.

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { generateMessageId } from '@lingui/message-utils/generateMessageId';

// @babel/traverse ships as CJS; the callable is on `.default` under ESM.
const traverse = _traverse.default ?? _traverse;

const HELPER_MODULE = /(^|\/)i18n\/translate(\.js)?$/;

/** Peel `x as T` / `x satisfies T` wrappers off a node to reach the value. */
function unwrap(node) {
	while (node && (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')) {
		node = node.expression;
	}
	return node;
}

/** @type {import('@lingui/conf').ExtractorType} */
const extractor = {
	match(filename) {
		return /\.tsx?$/.test(filename) && !filename.endsWith('.d.ts');
	},

	extract(filename, code, onMessageExtracted) {
		const ast = parse(code, {
			sourceType: 'module',
			plugins: ['typescript', 'jsx'],
		});

		// Track the local names bound to our helpers, so we only match the real
		// imports - not some unrelated function that happens to share a name.
		const translateNames = new Set();
		const defineNames = new Set();

		traverse(ast, {
			ImportDeclaration(path) {
				if (!HELPER_MODULE.test(path.node.source.value)) return;
				for (const spec of path.node.specifiers) {
					if (spec.type !== 'ImportSpecifier' || spec.imported.type !== 'Identifier') continue;
					if (spec.imported.name === '__') translateNames.add(spec.local.name);
					if (spec.imported.name === 'defineMessages') defineNames.add(spec.local.name);
				}
			},

			CallExpression(path) {
				const callee = path.node.callee;
				if (callee.type !== 'Identifier') return;
				const args = path.node.arguments;

				if (translateNames.has(callee.name)) {
					const message = unwrap(args[0]);
					const context = unwrap(args[1]);
					if (message?.type !== 'StringLiteral') return;
					const ctx = context?.type === 'StringLiteral' ? context.value : undefined;
					emit(message.value, ctx, message.loc);
				} else if (defineNames.has(callee.name)) {
					const obj = unwrap(args[0]);
					if (obj?.type !== 'ObjectExpression') return;
					for (const prop of obj.properties) {
						if (prop.type !== 'ObjectProperty') continue;
						const value = prop.value;
						if (value.type === 'StringLiteral') {
							emit(value.value, undefined, value.loc);
						} else if (value.type === 'ArrayExpression') {
							// Array-valued entries (per-level upgrade lists) - harvest each
							// string literal; non-string elements (numbers) aren't text.
							for (const el of value.elements) {
								if (el?.type === 'StringLiteral') emit(el.value, undefined, el.loc);
							}
						}
					}
				}
			},
		});

		function emit(message, context, loc) {
			onMessageExtracted({
				id: generateMessageId(message, context),
				message,
				context,
				origin: [filename, loc?.start.line ?? 0, loc?.start.column],
			});
		}
	},
};

export default extractor;
