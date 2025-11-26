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

// ✅ NUEVA RUTA PARA LIMPIAR ACCESO NO AUTORIZADO
router.post('/clean-unauthorized-access', authController.cleanUnauthorizedAccess);

// ✅ NUEVAS RUTAS DE CONTROL DE SESIONES
router.post('/logout', authMiddleware, authController.logout);
router.get('/session/check', authMiddleware, authController.checkSession);
router.post('/session/force-logout', authMiddleware, authController.forceLogout);
router.get('/session/stats', authMiddleware, authController.getSessionsStats);

// ✅ NUEVA RUTA: Restablecer contraseña por administrador
router.post('/admin-reset-password', authMiddleware, authController.adminResetPassword);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/verify-token', authMiddleware, authController.verifyToken);

// ✅ CORREGIDO: Manejo mejorado del callback de Google
router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
      if (err) {
        console.error('❌ Error en autenticación Google:', err);
        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendURL}/?authError=Error de autenticación`);
      }
      
      if (!user) {
        console.log('🔴 Autenticación cancelada o fallida');
        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendURL}/?authError=Autenticación cancelada`);
      }
      
      req.user = user;
      next();
    })(req, res, next);
  },
  (req, res) => {
    try {
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

      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      console.log('✅ Autenticación Google exitosa');
      
      res.redirect(`${frontendURL}/?token=${token}`);
      
    } catch (error) {
      console.error('❌ Error generando token:', error);
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendURL}/?authError=Error generando token`);
    }
  }
);

module.exports = router;
