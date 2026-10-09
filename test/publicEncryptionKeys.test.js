const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { isAcceptedPublicKeyPair } = require('../utils/publicEncryptionKeys');

const makeBrowserStyleKeys = async () => {
  const rsa = await webcrypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    false,
    ['encrypt', 'decrypt']
  );
  const ecdsa = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  return [
    await webcrypto.subtle.exportKey('jwk', rsa.publicKey),
    await webcrypto.subtle.exportKey('jwk', ecdsa.publicKey)
  ];
};

test('accepts browser-exported public keys when optional JWK alg metadata is absent', async () => {
  const [encryptionKey, signingKey] = await makeBrowserStyleKeys();
  delete signingKey.alg;
  assert.equal(isAcceptedPublicKeyPair(encryptionKey, signingKey), true);
});

test('rejects private, weak, or incorrectly typed encryption keys', async () => {
  const [encryptionKey, signingKey] = await makeBrowserStyleKeys();
  assert.equal(isAcceptedPublicKeyPair({ ...encryptionKey, d: 'private-material' }, signingKey), false);
  assert.equal(isAcceptedPublicKeyPair({ ...encryptionKey, n: Buffer.alloc(128).toString('base64url') }, signingKey), false);
  assert.equal(isAcceptedPublicKeyPair(encryptionKey, { ...signingKey, alg: 'ES384' }), false);
});
