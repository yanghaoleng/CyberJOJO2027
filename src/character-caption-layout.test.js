import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutCharacterCaption } from './character-caption-layout.js';
import { characterCaptionInternals } from './character-caption.js';
test('English captions keep whole words on at most two lines', () => {
  const text = 'Hello little explorer, can you find a red apple?';
  const lines = layoutCharacterCaption(text, 25, text => text.length);
  assert.deepEqual(lines, ['Hello little explorer,', 'can you find a red apple?']);
  assert.deepEqual(layoutCharacterCaption('Apple', 30, text => text.length), ['Apple']);
  assert.deepEqual(layoutCharacterCaption('supercalifragilisticexpialidocious', 10, text => text.length), ['supercalifragilisticexpialidocious']);
});
test('overflow removes entire words and canvas follows the same line rules', () => {
  const text = 'Look at the beautiful orange butterfly flying over the flowers today.';
  const lines = layoutCharacterCaption(text, 24, text => text.length);
  assert.equal(lines.length, 2); assert.ok(lines[1].endsWith('…'));
  for (const word of lines.join(' ').replace('…', '').split(' ')) assert.ok(text.split(' ').includes(word));
  assert.deepEqual(characterCaptionInternals.splitLines({ measureText: text => ({ width: text.length }) }, text, 24), lines);
});
