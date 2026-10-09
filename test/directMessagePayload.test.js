const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDirectMessagePayload } = require('../utils/directMessagePayload');

test('accepts trimmed account-synced text messages', () => {
  assert.deepEqual(normalizeDirectMessagePayload({ text: '  Hello from my phone  ' }), {
    kind: 'text',
    text: 'Hello from my phone'
  });
});

test('rejects empty, oversized, and mixed-format text messages', () => {
  assert.ok(normalizeDirectMessagePayload({ text: '  ' }).error);
  assert.ok(normalizeDirectMessagePayload({ text: 'x'.repeat(5001) }).error);
  assert.ok(normalizeDirectMessagePayload({ text: 'hello', ciphertext: 'old-format' }).error);
});

test('retains support for existing encrypted messages during transition', () => {
  assert.deepEqual(normalizeDirectMessagePayload({ ciphertext: 'legacy' }), { kind: 'legacy' });
});
