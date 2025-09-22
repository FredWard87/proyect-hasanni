const express = require('express');
const router = express.Router();
const preferencesController = require('../controllers/preferencesController');
const authMiddleware = require('../middlewares/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas de preferencias
router.get('/', preferencesController.getUserPreferences);
router.put('/', preferencesController.updateUserPreferences);
router.post('/reset', preferencesController.resetUserPreferences);
router.put('/specific', preferencesController.updateSpecificPreference);
router.get('/export', preferencesController.exportUserPreferences);

module.exports = router;