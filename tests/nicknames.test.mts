import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ADJECTIVES, ANIMAL_EMOJI, ANIMALS, NICKNAME_COUNT, nickname } from '../src/nicknames.ts';

const GENDERED = { es: 'mf', fr: 'mf', it: 'mf', pt: 'mf', ru: 'mf', de: 'mfn', ar: 'mf' } as Record<string, string>;

test('every language has 50 distinct animals and adjectives, gendered where it must be', () => {
  assert.equal(ANIMAL_EMOJI.length, 50);
  assert.deepEqual(Object.keys(ANIMALS).sort(), Object.keys(ADJECTIVES).sort());
  for (const lang of Object.keys(ANIMALS)) {
    assert.equal(new Set(ANIMALS[lang]).size, 50, `${lang} animals`);
    assert.equal(new Set(ADJECTIVES[lang]).size, 50, `${lang} adjectives`);
    for (const a of ANIMALS[lang]) {
      const g = a.split('|')[1];
      if (GENDERED[lang]) assert.ok(g && GENDERED[lang].includes(g), `${lang} ${a}`);
      else assert.equal(g, undefined, `${lang} ${a}`);
    }
    for (const a of ADJECTIVES[lang]) assert.ok(a.split('|').length <= 2 && !a.includes(',') && a.trim() === a, `${lang} ${a}`);
  }
});

test('names agree with the animal and sit in each language order', () => {
  const id = (adj: number, animal: number) => adj * 50 + animal;
  assert.equal(nickname(id(0, 1), 'ko'), '🦔 용감한 고슴도치');
  assert.equal(nickname(id(0, 1), 'en'), '🦔 Brave Hedgehog');
  assert.equal(nickname(id(0, 11), 'fr'), '🐝 Abeille courageuse');
  assert.equal(nickname(id(0, 2), 'de'), '🐿️ Mutiges Eichhörnchen');
  assert.equal(nickname(id(31, 10), 'de'), '🦉 Weise Eule');
  assert.equal(nickname(id(31, 1), 'de'), '🦔 Weiser Igel');
  assert.equal(nickname(id(0, 0), 'ru'), '🐞 Смелая божья коровка');
  assert.equal(nickname(id(0, 0), 'ja'), '🐞 勇敢なテントウムシ');
  assert.equal(nickname(id(0, 3), 'vi'), '🐢 Rùa dũng cảm');
  assert.equal(nickname(id(0, 1), 'ar'), '🦔 قنفذ شجاع');
  assert.equal(nickname(id(0, 15), 'ar'), '🐱 قطة شجاعة');
  assert.equal(nickname(id(0, 1), 'sw'), '🦔 Kalunguyeye Jasiri');
});

test('every id spells a name in every language; ids outside the list give nothing', () => {
  for (const lang of Object.keys(ANIMALS)) {
    const names = new Set(Array.from({ length: NICKNAME_COUNT }, (_, i) => nickname(i, lang)));
    assert.equal(names.size, NICKNAME_COUNT, lang);
  }
  assert.equal(nickname(NICKNAME_COUNT, 'ko'), '');
  assert.equal(nickname(-1, 'ko'), '');
  assert.equal(nickname(undefined, 'ko'), '');
  assert.equal(nickname(3, 'xx'), nickname(3, 'en'));
});
