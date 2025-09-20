const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

// Importar el controlador
const GeoOfflineController = require('../controllers/GeoOfflineController');
const geoController = new GeoOfflineController();

// === RUTAS DE GEOLOCALIZACIÓN ===

// Guardar ubicación del usuario
router.post('/location', authMiddleware, (req, res) => {
  geoController.saveUserLocation(req, res);
});

// Obtener usuarios cercanos
router.get('/nearby', authMiddleware, (req, res) => {
  geoController.getNearbyUsers(req, res);
});

// Obtener historial de ubicaciones
router.get('/history', authMiddleware, (req, res) => {
  geoController.getLocationHistory(req, res);
});

// Obtener estadísticas geográficas
router.get('/stats', authMiddleware, (req, res) => {
  geoController.getGeoStats(req, res);
});

// === RUTAS OFFLINE/PWA ===

// Obtener datos para modo offline
router.get('/offline-data', authMiddleware, (req, res) => {
  geoController.getOfflineData(req, res);
});

// Almacenar acción pendiente
router.post('/pending-action', authMiddleware, (req, res) => {
  geoController.storePendingAction(req, res);
});

// Sincronizar acciones pendientes
router.post('/sync', authMiddleware, (req, res) => {
  geoController.syncPendingActions(req, res);
});

// === RUTAS PWA ===

// Manifiesto de la aplicación web
router.get('/manifest', (req, res) => {
  geoController.generateManifest(req, res);
});

// Service Worker
router.get('/sw.js', (req, res) => {
  geoController.generateServiceWorker(req, res);
});

module.exports = router;