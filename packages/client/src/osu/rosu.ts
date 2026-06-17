import init from 'rosu-pp-js-web';
import wasmUrl from 'rosu-pp-js-web/rosu_pp_js_bg.wasm?url';

let ready: Promise<unknown> | undefined;

/**
 * Load the rosu-pp WebAssembly module once. Must be awaited before constructing
 * any `Difficulty`/`Performance`/`Beatmap` - otherwise the wasm bindings are
 * undefined and calls fail with `__wbindgen_add_to_stack_pointer`.
 */
export default function rosuReady(): Promise<unknown> {
	return ready ??= init(wasmUrl);
}
