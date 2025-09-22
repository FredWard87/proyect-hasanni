const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas de geolocalización
// POST /api/usuarios/ubicacion - Actualizar ubicación del usuario
router.post('/ubicacion', locationController.updateLocation);

// GET /api/usuarios/mi-ubicacion - Obtener mi ubicación actual
router.get('/mi-ubicacion', locationController.getMyLocation);

// GET /api/usuarios/cercanos - Obtener usuarios cercanos (solo admins)
router.get('/cercanos', locationController.getNearbyUsers);

// GET /api/usuarios/estadisticas-ubicacion - Estadísticas de ubicación (solo admins)
router.get('/estadisticas-ubicacion', locationController.getLocationStats);

// DELETE /api/usuarios/ubicacion - Eliminar datos de ubicación del usuario
router.delete('/ubicacion', locationController.deleteLocation);

module.exports = router;