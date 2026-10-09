const mongoose = require('mongoose');
const Connection = require('../models/Connection');
const Conversation = require('../models/Conversation');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');
const { isAcceptedPublicKeyPair } = require('../utils/publicEncryptionKeys');
const { isValidEncryptedKeyBackup } = require('../utils/encryptedKeyBackup');
const { normalizeDirectMessagePayload } = require('../utils/directMessagePayload');

const hasAcceptedConnection = async (userId, peerId) => Boolean(await Connection.exists({
  status: 'accepted',
  $or: [
    { requester: userId, recipient: peerId },
    { requester: peerId, recipient: userId }
  ]
}));

const isParticipant = (conversation, userId) => conversation.participants.some(
  (participant) => participant._id?.toString() === userId.toString() || participant.toString() === userId.toString()
);

const getAuthorizedConversation = async (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) return null;
  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
  if (!conversation) return null;
  const peerId = conversation.participants.find((participant) => participant.toString() !== userId.toString());
  if (!peerId || !(await hasAcceptedConnection(userId, peerId))) return null;
  return { conversation, peerId };
};

const getContacts = async (req, res, next) => {
  try {
    const accepted = await Connection.find({
      status: 'accepted',
      $or: [{ requester: req.user._id }, { recipient: req.user._id }]
    }).select('requester recipient').lean();

    const ids = accepted.map(({ requester, recipient }) => (
      requester.toString() === req.user._id.toString() ? recipient : requester
    ));
    const contacts = await User.find({ _id: { $in: ids } })
      .select('name headline profilePicture +encryptionPublicKey +encryptionSigningPublicKey encryptionKeyVersion')
      .lean();

    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, contacts });
  } catch (error) { next(error); }
};

const getOwnKey = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+encryptionPublicKey +encryptionSigningPublicKey encryptionKeyVersion');
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, publicKey: user?.encryptionPublicKey || '', signingPublicKey: user?.encryptionSigningPublicKey || '', keyVersion: user?.encryptionKeyVersion || 0 });
  } catch (error) { next(error); }
};

const getOwnKeyBackups = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+encryptionKeyBackups').lean();
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, backups: (user?.encryptionKeyBackups || []).map((backup) => ({
      _id: backup._id,
      formatVersion: backup.formatVersion,
      keyVersion: backup.keyVersion,
      publicKeyFingerprint: backup.publicKeyFingerprint,
      kdf: backup.kdf,
      iterations: backup.iterations,
      cipher: backup.cipher,
      salt: backup.salt,
      iv: backup.iv,
      ciphertext: backup.ciphertext,
      createdAt: backup.createdAt
    })) });
  } catch (error) { next(error); }
};

const saveOwnKeyBackup = async (req, res, next) => {
  try {
    const backup = req.body || {};
    const user = await User.findById(req.user._id).select('+encryptionPublicKey +encryptionSigningPublicKey +encryptionKeyBackups encryptionKeyVersion');
    if (!user?.encryptionPublicKey || !user?.encryptionSigningPublicKey) {
      return res.status(409).json({ success: false, message: 'Set up encrypted messaging on this account before creating a recovery backup.' });
    }
    if (user.encryptionKeyBackups.length >= 5) {
      return res.status(409).json({ success: false, message: 'This account already has five encrypted recovery backups. Keep them safe and remove none from the original device.' });
    }

    if (!isValidEncryptedKeyBackup(backup, {
      keyVersion: user.encryptionKeyVersion,
      publicKey: user.encryptionPublicKey,
      signingPublicKey: user.encryptionSigningPublicKey
    })) return res.status(400).json({ success: false, message: 'Invalid encrypted recovery backup.' });

    user.encryptionKeyBackups.push({
      formatVersion: backup.formatVersion,
      keyVersion: backup.keyVersion,
      publicKeyFingerprint: backup.publicKeyFingerprint,
      kdf: backup.kdf,
      iterations: backup.iterations,
      cipher: backup.cipher,
      salt: backup.salt,
      iv: backup.iv,
      ciphertext: backup.ciphertext
    });
    await user.save();
    res.set('Cache-Control', 'private, no-store');
    res.status(201).json({ success: true, backupCount: user.encryptionKeyBackups.length });
  } catch (error) { next(error); }
};

const saveOwnKey = async (req, res, next) => {
  try {
    const { publicKey, signingPublicKey } = req.body;
    if (typeof publicKey !== 'string' || publicKey.length > 4096 || typeof signingPublicKey !== 'string' || signingPublicKey.length > 4096) {
      return res.status(400).json({ success: false, message: 'Invalid public encryption key.' });
    }
    let parsedEncryptionKey;
    let parsedSigningKey;
    try {
      parsedEncryptionKey = JSON.parse(publicKey);
      parsedSigningKey = JSON.parse(signingPublicKey);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid public encryption key.' });
    }
    if (!isAcceptedPublicKeyPair(parsedEncryptionKey, parsedSigningKey)) {
      return res.status(400).json({ success: false, message: 'Only public RSA-OAEP and ECDSA P-256 keys are accepted.' });
    }

    const user = await User.findById(req.user._id).select('+encryptionPublicKey +encryptionSigningPublicKey encryptionKeyVersion');
    if ((user.encryptionPublicKey && user.encryptionPublicKey !== publicKey) ||
        (user.encryptionSigningPublicKey && user.encryptionSigningPublicKey !== signingPublicKey)) {
      return res.status(409).json({
        success: false,
        keyConflict: true,
        message: 'An encryption key is already registered. Replacing it can make existing messages unreadable.'
      });
    }
    if (!user.encryptionPublicKey || !user.encryptionSigningPublicKey) {
      user.encryptionPublicKey = publicKey;
      user.encryptionSigningPublicKey = signingPublicKey;
      user.encryptionKeyVersion += 1;
      await user.save();
    }
    res.json({ success: true, publicKey: user.encryptionPublicKey, signingPublicKey: user.encryptionSigningPublicKey, keyVersion: user.encryptionKeyVersion });
  } catch (error) { next(error); }
};

const listConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'name headline profilePicture');
    const visible = [];
    for (const conversation of conversations) {
      const peer = conversation.participants.find((participant) => participant._id.toString() !== req.user._id.toString());
      if (!peer || !(await hasAcceptedConnection(req.user._id, peer._id))) continue;
      const lastMessage = await DirectMessage.findOne({ conversation: conversation._id })
        .sort({ createdAt: -1 }).select('createdAt sender text');
      visible.push({ _id: conversation._id, peer, lastMessageAt: conversation.lastMessageAt, lastMessage });
    }
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, conversations: visible });
  } catch (error) { next(error); }
};

const openConversation = async (req, res, next) => {
  try {
    const peerId = req.params.userId;
    if (!mongoose.isValidObjectId(peerId) || peerId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Choose a valid connected person.' });
    }
    if (!(await hasAcceptedConnection(req.user._id, peerId))) {
      return res.status(403).json({ success: false, message: 'Messages are only available between accepted connections.' });
    }
    const peer = await User.findById(peerId).select('name headline profilePicture +encryptionPublicKey +encryptionSigningPublicKey encryptionKeyVersion');
    if (!peer) return res.status(404).json({ success: false, message: 'Connected account not found.' });

    const pairKey = [req.user._id.toString(), peer._id.toString()].sort().join(':');
    let conversation = await Conversation.findOne({ pairKey });
    if (!conversation) {
      try {
        conversation = await Conversation.create({ pairKey, participants: [req.user._id, peer._id] });
      } catch (error) {
        if (error.code !== 11000) throw error;
        conversation = await Conversation.findOne({ pairKey });
      }
    }
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, conversation: { _id: conversation._id, peer } });
  } catch (error) { next(error); }
};

const getMessages = async (req, res, next) => {
  try {
    const authorized = await getAuthorizedConversation(req.params.conversationId, req.user._id);
    if (!authorized) return res.status(404).json({ success: false, message: 'Conversation not found or no longer available.' });

    const messages = await DirectMessage.find({ conversation: authorized.conversation._id })
      .sort({ createdAt: -1 }).limit(200).lean();
    await DirectMessage.updateMany(
      { conversation: authorized.conversation._id, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, messages: messages.reverse() });
  } catch (error) { next(error); }
};

const sendMessage = async (req, res, next) => {
  try {
    const authorized = await getAuthorizedConversation(req.params.conversationId, req.user._id);
    if (!authorized) return res.status(404).json({ success: false, message: 'Conversation not found or no longer available.' });

    const normalizedPayload = normalizeDirectMessagePayload(req.body);
    if (normalizedPayload.error) return res.status(400).json({ success: false, message: normalizedPayload.error });
    if (normalizedPayload.kind === 'text') {
      const messageTimestamp = new Date();
      const [message] = await Promise.all([
        DirectMessage.create({
          conversation: authorized.conversation._id,
          sender: req.user._id,
          text: normalizedPayload.text,
          readBy: [req.user._id],
          createdAt: messageTimestamp,
          updatedAt: messageTimestamp
        }),
        Conversation.updateOne(
          { _id: authorized.conversation._id },
          { $max: { lastMessageAt: messageTimestamp } }
        )
      ]);
      res.set('Cache-Control', 'private, no-store');
      return res.status(201).json({ success: true, message });
    }

    const participantIds = authorized.conversation.participants.map((id) => id.toString()).sort();
    if (typeof ciphertext !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(ciphertext) || ciphertext.length > 180000 ||
        typeof iv !== 'string' || !/^[A-Za-z0-9+/]{16}={0,2}$/.test(iv) ||
        !Array.isArray(wrappedKeys) || wrappedKeys.length !== 2 || typeof signature !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(signature) || signature.length > 256) {
      return res.status(400).json({ success: false, message: 'Invalid encrypted message payload.' });
    }

    const normalizedKeys = wrappedKeys.map((entry) => ({ user: String(entry.user), value: entry.value }));
    const wrappedIds = normalizedKeys.map(({ user }) => user).sort();
    if (participantIds.join(':') !== wrappedIds.join(':') || normalizedKeys.some(({ value }) => (
      typeof value !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(value) || value.length > 2048
    ))) {
      return res.status(400).json({ success: false, message: 'The message must be encrypted for both conversation participants.' });
    }

    const message = await DirectMessage.create({
      conversation: authorized.conversation._id,
      sender: req.user._id,
      ciphertext,
      iv,
      signature,
      wrappedKeys: normalizedKeys,
      readBy: [req.user._id]
    });
    authorized.conversation.lastMessageAt = message.createdAt;
    await authorized.conversation.save();

    res.status(201).json({ success: true, message });
  } catch (error) { next(error); }
};

const syncLegacyMessages = async (req, res, next) => {
  try {
    const authorized = await getAuthorizedConversation(req.params.conversationId, req.user._id);
    if (!authorized) return res.status(404).json({ success: false, message: 'Conversation not found or no longer available.' });

    const entries = req.body?.messages;
    if (!Array.isArray(entries) || entries.length > 200) {
      return res.status(400).json({ success: false, message: 'Provide up to 200 messages to sync.' });
    }
    const updates = [];
    for (const entry of entries) {
      if (!mongoose.isValidObjectId(entry?.id)) {
        return res.status(400).json({ success: false, message: 'Invalid legacy message id.' });
      }
      const normalized = normalizeDirectMessagePayload({ text: entry.text });
      if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });
      updates.push({
        updateOne: {
          filter: { _id: entry.id, conversation: authorized.conversation._id, text: { $exists: false } },
          update: { $set: { text: normalized.text } }
        }
      });
    }

    const result = updates.length ? await DirectMessage.bulkWrite(updates, { ordered: false }) : { modifiedCount: 0 };
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, synced: result.modifiedCount || 0 });
  } catch (error) { next(error); }
};

module.exports = { getContacts, getOwnKey, getOwnKeyBackups, saveOwnKeyBackup, saveOwnKey, listConversations, openConversation, getMessages, sendMessage, syncLegacyMessages };
