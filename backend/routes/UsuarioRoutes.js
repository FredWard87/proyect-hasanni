const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/UsuarioController');
const authMiddleware = require('../middlewares/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware); 

// === RUTAS API ===

// GET /api/health - Health check
router.get('/usuarios', ...)
router.get('/usuarios/roles', ...)
router.get('/usuarios/estadisticas', ...)
router.get('/usuarios/:id', ...)
router.post('/usuarios', ...)
router.put('/usuarios/:id', ...)
router.delete('/usuarios/:id', ...)




module.exports = router;
