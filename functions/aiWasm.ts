type WasmBindings = typeof import('../ai-rust/wasm-ai/ai_rust.js');

let wasmModule: WasmBindings | null = null;
let wasmInitPromise: Promise<WasmBindings> | null = null;

async function loadWasmModule(): Promise<WasmBindings> {
  if (wasmModule) return wasmModule;
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      if (typeof WebAssembly === 'undefined') {
        throw new Error('WebAssembly is not available on this runtime. Switch to a WebAssembly-enabled engine (QuickJS or web).');
      }

      const module = await import('../ai-rust/wasm-ai/ai_rust.js');
      wasmModule = module;
      return module;
    })();
  }
  return wasmInitPromise;
}

export async function getBestMoveWasm(state: string): Promise<string> {
  const module = await loadWasmModule();
  return module.get_best_move(state);
}

export function isWasmSupported(): boolean {
  return typeof WebAssembly !== 'undefined';
}