const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  pairKey: { type: String, required: true, unique: true, index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessageAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
