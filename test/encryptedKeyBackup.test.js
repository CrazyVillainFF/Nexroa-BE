const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { getPublicKeyFingerprint, isValidEncryptedKeyBackup } = require('../utils/encryptedKeyBackup');

test('accepts only a bounded encrypted backup bound to the account public keys and key version', async () => {
  const encryption = await webcrypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    false,
    ['encrypt', 'decrypt'],
  );
  const signing = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const publicKey = JSON.stringify(await webcrypto.subtle.exportKey('jwk', encryption.publicKey));
  const signingPublicKey = JSON.stringify(await webcrypto.subtle.exportKey('jwk', signing.publicKey));
  const account = { keyVersion: 2, publicKey, signingPublicKey };
  const backup = {
    formatVersion: 1,
    keyVersion: 2,
    publicKeyFingerprint: getPublicKeyFingerprint(publicKey, signingPublicKey),
    kdf: 'PBKDF2-SHA-256',
    iterations: 600000,
    cipher: 'AES-256-GCM',
    salt: Buffer.alloc(16, 1).toString('base64'),
    iv: Buffer.alloc(12, 2).toString('base64'),
    ciphertext: Buffer.alloc(64, 3).toString('base64'),
  };

  assert.equal(isValidEncryptedKeyBackup(backup, account), true);
  assert.equal(isValidEncryptedKeyBackup({ ...backup, keyVersion: 1 }, account), false);
  assert.equal(isValidEncryptedKeyBackup({ ...backup, publicKeyFingerprint: '0'.repeat(64) }, account), false);
  assert.equal(isValidEncryptedKeyBackup({ ...backup, salt: 'short' }, account), false);
  assert.equal(isValidEncryptedKeyBackup({ ...backup, ciphertext: 'plaintext' }, account), false);
});
