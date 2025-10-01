import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as wasmBindings from '../ai-rust/wasm-ai/ai_rust_bg.js';

type WasmExports = typeof import('../ai-rust/wasm-ai/ai_rust_bg.wasm');

type WasmInitState = {
  instance: WebAssembly.Instance | null;
  readyPromise: Promise<void> | null;
  error: Error | null;
};

const wasmState: WasmInitState = {
  instance: null,
  readyPromise: null,
  error: null,
};

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/g, '').replace(/=+$/, '');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(normalized);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  const output: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    const value = BASE64_ALPHABET.indexOf(normalized[i]);
    if (value === -1) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bitsCollected += 6;

    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      output.push((buffer >> bitsCollected) & 0xff);
    }
  }

  return Uint8Array.from(output);
}

async function readWasmBinary(): Promise<Uint8Array> {
  const wasmAsset = Asset.fromModule(require('../ai-rust/wasm-ai/ai_rust_bg.wasm'));

  if (!wasmAsset.downloaded) {
    await wasmAsset.downloadAsync();
  }

  const uri = wasmAsset.localUri ?? wasmAsset.uri;
  if (!uri) {
    throw new Error('Unable to resolve ai_rust_bg.wasm asset URI.');
  }

  const base64Content = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return decodeBase64(base64Content);
}

async function initialiseWasm(): Promise<void> {
  if (wasmState.instance) {
    return;
  }

  if (wasmState.error) {
    throw wasmState.error;
  }

  if (!wasmState.readyPromise) {
    wasmState.readyPromise = (async () => {
      if (typeof WebAssembly === 'undefined') {
        throw new Error('WebAssembly API unavailable in this environment.');
      }

      const binary = await readWasmBinary();

      const imports = {
        __wbindgen_placeholder__: {
          __wbg_error_7534b8e9a36f1ab4: wasmBindings.__wbg_error_7534b8e9a36f1ab4,
          __wbg_new_8a6f238a6ece86ea: wasmBindings.__wbg_new_8a6f238a6ece86ea,
          __wbg_stack_0ed75d68575b0f3c: wasmBindings.__wbg_stack_0ed75d68575b0f3c,
          __wbindgen_init_externref_table: wasmBindings.__wbindgen_init_externref_table,
        },
      } satisfies WebAssembly.Imports;

      const { instance } = await WebAssembly.instantiate(binary, imports);

      wasmBindings.__wbg_set_wasm(instance.exports as unknown as WasmExports);
      if (typeof (instance.exports as WasmExports).__wbindgen_start === 'function') {
        (instance.exports as WasmExports).__wbindgen_start();
      }
      if (typeof wasmBindings.init_panic_hook === 'function') {
        wasmBindings.init_panic_hook();
      }

      wasmState.instance = instance;
    })().catch(error => {
      wasmState.error = error instanceof Error ? error : new Error(String(error));
      throw wasmState.error;
    });
  }

  await wasmState.readyPromise;
}

export async function getBestMoveWasm(state: string): Promise<string> {
  await initialiseWasm();
  return wasmBindings.get_best_move(state);
}

export function isWasmSupported(): boolean {
  return true;
}
