const { createHash } = require('crypto');

const canonicalizeJwk = (value) => JSON.stringify(Object.fromEntries(
  Object.entries(JSON.parse(value)).sort(([left], [right]) => left.localeCompare(right))
));

const getPublicKeyFingerprint = (publicKey, signingPublicKey) => createHash('sha256')
  .update(JSON.stringify([JSON.parse(canonicalizeJwk(publicKey)), JSON.parse(canonicalizeJwk(signingPublicKey))]))
  .digest('hex');

const validBase64 = (value, expectedBytes, maxBytes) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const decoded = Buffer.from(value, 'base64');
  return decoded.toString('base64') === value && decoded.length <= maxBytes &&
    (expectedBytes == null || decoded.length === expectedBytes);
};

const isValidEncryptedKeyBackup = (backup, account) => {
  if (!backup || !account?.publicKey || !account?.signingPublicKey) return false;
  try {
    return backup.formatVersion === 1 && backup.keyVersion === account.keyVersion &&
      backup.kdf === 'PBKDF2-SHA-256' && backup.iterations === 600000 && backup.cipher === 'AES-256-GCM' &&
      backup.publicKeyFingerprint === getPublicKeyFingerprint(account.publicKey, account.signingPublicKey) &&
      validBase64(backup.salt, 16, 16) && validBase64(backup.iv, 12, 12) &&
      validBase64(backup.ciphertext, null, 15000) && Buffer.from(backup.ciphertext, 'base64').length >= 32;
  } catch {
    return false;
  }
};

module.exports = { getPublicKeyFingerprint, isValidEncryptedKeyBackup };
