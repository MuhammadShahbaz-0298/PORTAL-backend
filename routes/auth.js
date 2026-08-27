const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { register, login, getMe, changePassword } = require('../controllers/authController');

// Admin-only: creates student/teacher accounts and sets their initial password.
// No public signup route — there is no "register yourself" flow in this app.
router.post('/register', auth, requireRole('admin'), register);

router.post('/login', login);
router.get('/me', auth, getMe);
router.post('/change-password', auth, changePassword);

module.exports = router;
