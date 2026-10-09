const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getContacts,
  getOwnKey,
  saveOwnKey,
  listConversations,
  openConversation,
  getMessages,
  sendMessage
} = require('../controllers/messageController');

const router = express.Router();
router.use(protect);
router.get('/contacts', getContacts);
router.get('/keys/me', getOwnKey);
router.put('/keys/me', saveOwnKey);
router.get('/conversations', listConversations);
router.post('/conversations/:userId', openConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', sendMessage);

module.exports = router;
