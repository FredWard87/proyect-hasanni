const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// ✅ CORRECTO: No hay middleware duplicado aquí

// Rutas de geolocalización
router.post('/ubicacion', locationController.updateLocation);
router.get('/mi-ubicacion', locationController.getMyLocation);
router.get('/cercanos', locationController.getNearbyUsers);
router.get('/estadisticas-ubicacion', locationController.getLocationStats);
router.delete('/ubicacion', locationController.deleteLocation);

module.exports = router;