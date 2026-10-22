import { test } from 'node:test';
import assert from 'node:assert/strict';

import { asciiBytes, asciiJson, backupMagic, bytesText, entryHeader, readEntries } from '../src/backupFormat.ts';

function reader(bytes: Uint8Array) {
  let at = 0;
  return (length: number) => bytes.subarray(at, (at += length));
}

const join = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) out.set(p, (at += p.length) - p.length);
  return out;
};

test('backup entries round-trip, notes in any language included', () => {
  const data = { note: '네잎 🍀 trèfle' };
  const json = asciiBytes(asciiJson(data));
  const photo = new Uint8Array([0, 255, 1, 128]);
  const file = join([backupMagic(), entryHeader('data.json', json.length), json, entryHeader('finds/a.jpg', photo.length), photo]);
  const entries = [...readEntries(reader(file))];
  assert.deepEqual(entries.map((e) => e.name), ['data.json', 'finds/a.jpg']);
  assert.deepEqual(JSON.parse(bytesText(entries[0].data)), data);
  assert.deepEqual([...entries[1].data], [0, 255, 1, 128]);
});

test('a foreign or cut-short file is refused', () => {
  assert.throws(() => [...readEntries(reader(asciiBytes('PK\u0003\u0004 zip')))], /not a Hello Luck backup/);
  const json = asciiBytes('{}');
  const file = join([backupMagic(), entryHeader('data.json', json.length), json]);
  assert.throws(() => [...readEntries(reader(file.subarray(0, file.length - 1)))], /cut short/);
});
