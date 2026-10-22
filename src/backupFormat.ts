/**
 * The backup file: "HLB1", then entries of [u32 name length][name][u32 data length][data] (big-endian).
 * Written and read in pieces, so a backup with hundreds of photos never sits in memory whole.
 * Pure (no React Native) so tests run it directly.
 */
const MAGIC = 'HLB1';

/** Text as bytes, one per character: JSON is escaped to ASCII first (asciiJson). */
export const asciiBytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

export function bytesText(bytes: Uint8Array) {
  let text = '';
  // Chunked: fromCharCode with a huge argument list overflows the stack.
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return text;
}

/** JSON with every non-ASCII character as \uXXXX, so one byte per character still round-trips notes in any language. */
export const asciiJson = (value: unknown) =>
  JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const u32 = (n: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n);
  return out;
};

export const backupMagic = () => asciiBytes(MAGIC);

/** Bytes that go before an entry's data. Names are short ASCII paths such as "data.json" or "finds/abc.jpg". */
export function entryHeader(name: string, size: number) {
  const n = asciiBytes(name);
  const out = new Uint8Array(8 + n.length);
  out.set(u32(n.length), 0);
  out.set(n, 4);
  out.set(u32(size), 4 + n.length);
  return out;
}

/** Entries of a backup, given a reader that returns up to `length` bytes (fewer only at the end of the file). */
export function* readEntries(read: (length: number) => Uint8Array): Generator<{ name: string; data: Uint8Array }> {
  const take = (length: number) => {
    const bytes = read(length);
    if (bytes.length !== length) throw new Error('backup: file is cut short');
    return bytes;
  };
  const number = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
  if (bytesText(read(4)) !== MAGIC) throw new Error('backup: not a Hello Luck backup');
  for (;;) {
    const head = read(4);
    if (head.length === 0) return;
    if (head.length !== 4) throw new Error('backup: file is cut short');
    const nameLength = number(head);
    if (nameLength > 200) throw new Error('backup: bad entry');
    const name = bytesText(take(nameLength));
    yield { name, data: take(number(take(4))) };
  }
}
