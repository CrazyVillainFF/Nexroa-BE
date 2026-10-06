const express = require('express');
const router = express.Router();
const {
  getUsers,
  getSuggestedUsers,
  getUserById,
  updateProfile,
  uploadAvatar,
  uploadCover,
  searchUsers,
  updateSettings
} = require('../controllers/userController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

router.get('/', optionalAuth, getUsers);
router.get('/search', optionalAuth, searchUsers);
router.get('/suggested', protect, getSuggestedUsers);
router.put('/profile', protect, updateProfile);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);
router.post('/cover', protect, upload.single('cover'), uploadCover);
router.put('/settings', protect, updateSettings);
router.get('/:id', optionalAuth, getUserById);

module.exports = router;
