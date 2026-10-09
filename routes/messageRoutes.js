const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getContacts,
  getOwnKey,
  saveOwnKey,
  getOwnKeyBackups,
  saveOwnKeyBackup,
  listConversations,
  openConversation,
  getMessages,
  sendMessage,
  syncLegacyMessages
} = require('../controllers/messageController');

const router = express.Router();
router.use(protect);
router.get('/contacts', getContacts);
router.get('/keys/me', getOwnKey);
router.put('/keys/me', saveOwnKey);
router.get('/keys/backups', getOwnKeyBackups);
router.post('/keys/backups', saveOwnKeyBackup);
router.get('/conversations', listConversations);
router.post('/conversations/:userId', openConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', sendMessage);
router.post('/conversations/:conversationId/messages/sync-legacy', syncLegacyMessages);

module.exports = router;
