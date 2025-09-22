const express = require('express');
const router = express.Router();
const BiometricController = require('../controllers/biometricController');
const authMiddleware = require('../middlewares/authMiddleware');
const { checkBiometricSetup } = require('../middlewares/biometricMiddleware');

// Todas las rutas requieren autenticación normal
router.use(authMiddleware);
router.use(checkBiometricSetup);

// Rutas de PIN biométrico
router.post('/setup-pin', BiometricController.setupPIN);
router.post('/verify-pin', BiometricController.verifyPIN);
router.get('/status', BiometricController.getPINStatus);
router.post('/disable', BiometricController.disableBiometric);
router.post('/change-pin', BiometricController.changePIN);

module.exports = router;