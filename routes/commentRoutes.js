const express = require('express');
const router = express.Router();
const {
  addComment,
  getPostComments,
  deleteComment
} = require('../controllers/commentController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// Post-nested comment routes
router.post('/:postId/comments', protect, addComment);
router.get('/:postId/comments', optionalAuth, getPostComments);

// Standalone comment deletion
router.delete('/:id', protect, deleteComment);

module.exports = router;
