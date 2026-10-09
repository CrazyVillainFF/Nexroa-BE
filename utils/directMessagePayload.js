const normalizeDirectMessagePayload = (payload = {}) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'text')) return { kind: 'legacy' };
  if (typeof payload.text !== 'string') return { error: 'Message text must contain 1 to 5000 characters.' };

  const text = payload.text.trim();
  if (!text || text.length > 5000 || payload.ciphertext || payload.iv || payload.signature || payload.wrappedKeys) {
    return { error: 'Message text must contain 1 to 5000 characters.' };
  }
  return { kind: 'text', text };
};

module.exports = { normalizeDirectMessagePayload };
