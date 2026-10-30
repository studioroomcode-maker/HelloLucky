/**
 * Web stand-in for expo-file-system/legacy (metro.config.js aliases it on web only): just the calls this app makes.
 * "Files" under documentDirectory live in IndexedDB; blob:/data: URIs (camera photos, crops) are read straight.
 */
export const documentDirectory = 'file:///doc/';
export const cacheDirectory = 'file:///cache/';
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const;

const db = new Promise<IDBDatabase>((resolve, reject) => {
  const open = indexedDB.open('hellolucky-files', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('files');
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await db).transaction('files', mode).objectStore('files');
  return new Promise((resolve, reject) => {
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const isUrl = (uri: string) => /^(blob|data|https?):/.test(uri);
const under = (dir: string) => IDBKeyRange.bound(dir.endsWith('/') ? dir : `${dir}/`, `${dir}/￿`);

function base64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function readAsStringAsync(
  uri: string,
  options: { encoding?: string; position?: number; length?: number } = {},
): Promise<string> {
  if (!isUrl(uri)) {
    const value = await run('readonly', (s) => s.get(uri));
    if (value === undefined) throw new Error(`file not found: ${uri}`);
    if (options.encoding !== EncodingType.Base64) return String(value);
    return base64(new TextEncoder().encode(String(value)));
  }
  let blob = await (await fetch(uri)).blob();
  if (options.position !== undefined || options.length !== undefined) {
    const from = options.position ?? 0;
    blob = blob.slice(from, options.length === undefined ? undefined : from + options.length);
  }
  return options.encoding === EncodingType.Base64 ? base64(new Uint8Array(await blob.arrayBuffer())) : blob.text();
}

export async function writeAsStringAsync(uri: string, contents: string) {
  await run('readwrite', (s) => s.put(contents, uri));
}

export async function getInfoAsync(uri: string) {
  if (isUrl(uri)) return { exists: true, uri };
  return { exists: (await run('readonly', (s) => s.count(uri))) > 0, uri };
}

export async function deleteAsync(uri: string, _options?: { idempotent?: boolean }) {
  if (uri.startsWith('blob:')) return URL.revokeObjectURL(uri);
  if (isUrl(uri)) return;
  await run('readwrite', (s) => s.delete(uri));
  await run('readwrite', (s) => s.delete(under(uri)));
}

export async function copyAsync({ from, to }: { from: string; to: string }) {
  const value = isUrl(from) ? await readAsStringAsync(from) : await run('readonly', (s) => s.get(from));
  if (value === undefined) throw new Error(`file not found: ${from}`);
  await run('readwrite', (s) => s.put(value, to));
}

export async function moveAsync({ from, to }: { from: string; to: string }) {
  await copyAsync({ from, to });
  await deleteAsync(from);
}

export async function makeDirectoryAsync(_uri: string, _options?: { intermediates?: boolean }) {}
