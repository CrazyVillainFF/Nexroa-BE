const express = require('express');
const router = express.Router();
const {
  createPost,
  getFeed,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLikePost
} = require('../controllers/postController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { upload, validateImageContent } = require('../middleware/uploadMiddleware');

router.post('/', protect, upload.single('image'), validateImageContent, createPost);
router.get('/feed', optionalAuth, getFeed);
router.get('/user/:userId', optionalAuth, getUserPosts);
router.get('/:id', optionalAuth, getPostById);
router.put('/:id', protect, upload.single('image'), validateImageContent, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, toggleLikePost);

module.exports = router;
