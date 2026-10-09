const isPublicRsaOaepKey = (key) => {
  if (!key || key.kty !== 'RSA' || (key.alg && key.alg !== 'RSA-OAEP-256') || key.d ||
      typeof key.n !== 'string' || !/^[A-Za-z0-9_-]+$/.test(key.n) || key.e !== 'AQAB') {
    return false;
  }
  if (Array.isArray(key.key_ops) && (key.key_ops.length !== 1 || key.key_ops[0] !== 'encrypt')) return false;
  return Buffer.from(key.n, 'base64url').length >= 256;
};

const isPublicEcdsaKey = (key) => {
  if (!key || key.kty !== 'EC' || (key.alg && key.alg !== 'ES256') || key.crv !== 'P-256' ||
      typeof key.x !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key.x) ||
      typeof key.y !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key.y) || key.d) {
    return false;
  }
  if (Array.isArray(key.key_ops) && (key.key_ops.length !== 1 || key.key_ops[0] !== 'verify')) return false;
  return true;
};

const isAcceptedPublicKeyPair = (encryptionKey, signingKey) => (
  isPublicRsaOaepKey(encryptionKey) && isPublicEcdsaKey(signingKey)
);

module.exports = { isAcceptedPublicKeyPair };
