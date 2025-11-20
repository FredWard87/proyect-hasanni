const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/UsuarioController');
const authMiddleware = require('../middlewares/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// === RUTAS API ===

// GET /api/usuarios - Obtener todos los usuarios
router.get('/usuarios', UsuarioController.obtenerUsuarios);

// GET /api/usuarios/roles - Obtener roles válidos
router.get('/usuarios/roles', UsuarioController.obtenerRoles);

// GET /api/usuarios/estadisticas - Obtener estadísticas
router.get('/usuarios/estadisticas', UsuarioController.obtenerEstadisticas);

// GET /api/usuarios/:id - Obtener usuario por ID
router.get('/usuarios/:id', UsuarioController.obtenerUsuarioPorId);

// POST /api/usuarios - Crear nuevo usuario
router.post('/usuarios', UsuarioController.crearUsuario);

// PUT /api/usuarios/:id - Actualizar usuario
router.put('/usuarios/:id', UsuarioController.actualizarUsuario);

// DELETE /api/usuarios/:id - Eliminar usuario
router.delete('/usuarios/:id', UsuarioController.eliminarUsuario);

module.exports = router;
