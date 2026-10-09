const mongoose = require('mongoose');

const PasswordResetCounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  count: { type: Number, default: 0, min: 0 },
  windowStartedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

module.exports = mongoose.model('PasswordResetCounter', PasswordResetCounterSchema);
