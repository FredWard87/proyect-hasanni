const express = require('express');
const router = express.Router();
const BiometricController = require('../controllers/biometricController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas públicas (sin autenticación)
router.post('/request-pin-reset', BiometricController.requestPINReset);
router.post('/verify-code-only', BiometricController.verifyCodeOnly);
router.post('/reset-pin-final', BiometricController.resetPINWithCode);
router.post('/check-reset-status', BiometricController.checkResetCodeStatus);

// Rutas protegidas (con autenticación)
router.post('/setup-pin', authMiddleware, BiometricController.setupPIN);
router.post('/verify-pin', authMiddleware, BiometricController.verifyPIN);
router.get('/status', authMiddleware, BiometricController.getPINStatus);
router.post('/disable', authMiddleware, BiometricController.disableBiometric);
router.post('/change-pin', authMiddleware, BiometricController.changePIN);

module.exports = router;