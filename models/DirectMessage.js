const mongoose = require('mongoose');

const DirectMessageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ciphertext: { type: String, required: true, maxlength: 180000 },
  iv: { type: String, required: true, match: /^[A-Za-z0-9+/]{16}={0,2}$/ },
  signature: { type: String, required: true, maxlength: 256 },
  wrappedKeys: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    value: { type: String, required: true, maxlength: 2048 }
  }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

DirectMessageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('DirectMessage', DirectMessageSchema);
