const mongoose = require('mongoose');
const Connection = require('../models/Connection');
const Conversation = require('../models/Conversation');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');

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
    if (parsedEncryptionKey.kty !== 'RSA' || parsedEncryptionKey.alg !== 'RSA-OAEP-256' || !parsedEncryptionKey.n || !parsedEncryptionKey.e || parsedEncryptionKey.d ||
        parsedSigningKey.kty !== 'EC' || parsedSigningKey.alg !== 'ES256' || parsedSigningKey.crv !== 'P-256' || !parsedSigningKey.x || !parsedSigningKey.y || parsedSigningKey.d) {
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
        .sort({ createdAt: -1 }).select('createdAt sender');
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
    const [currentUser, peer] = await Promise.all([
      User.findById(req.user._id).select('+encryptionPublicKey +encryptionSigningPublicKey encryptionKeyVersion'),
      User.findById(peerId).select('name headline profilePicture +encryptionPublicKey +encryptionSigningPublicKey encryptionKeyVersion')
    ]);
    if (!peer) return res.status(404).json({ success: false, message: 'Connected account not found.' });
    if (!currentUser.encryptionPublicKey || !currentUser.encryptionSigningPublicKey || !peer.encryptionPublicKey || !peer.encryptionSigningPublicKey) {
      return res.status(409).json({ success: false, encryptionSetupRequired: true, message: 'Both people need to set up an encryption key before messaging.' });
    }

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

    const { ciphertext, iv, wrappedKeys, signature } = req.body;
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

module.exports = { getContacts, getOwnKey, saveOwnKey, listConversations, openConversation, getMessages, sendMessage };
