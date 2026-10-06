const express = require('express');
const router = express.Router();
const {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectOrRemoveConnection,
  getConnections
} = require('../controllers/connectionController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getConnections);
router.post('/:userId', sendConnectionRequest);
router.put('/:requestId/accept', acceptConnectionRequest);
router.delete('/:requestId', rejectOrRemoveConnection);

module.exports = router;
