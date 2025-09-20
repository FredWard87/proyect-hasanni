const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const passport = require('../passport');
const jwt = require('jsonwebtoken');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/2fa/verify', authController.verifyOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authMiddleware, authController.me);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?error=google' }),
  (req, res) => {
    const token = jwt.sign(
      {
        userId: req.user.id,
        nombre: req.user.nombre,
        email: req.user.email,
        rol: req.user.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.redirect(`${process.env.FRONTEND_URL}/?token=${token}`);
  }
);

module.exports = router;