const mongoose = require('mongoose');

const PasswordResetStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  codeHash: { type: String, default: '' },
  codeExpiresAt: { type: Date, default: null },
  verificationAttempts: { type: Number, default: 0 },
  resetTokenHash: { type: String, default: '' },
  resetTokenExpiresAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('PasswordResetState', PasswordResetStateSchema);
