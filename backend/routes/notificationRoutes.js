const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener notificaciones del usuario
router.get('/', notificationController.getUserNotifications);

// Obtener conteo de no leídas
router.get('/unread-count', notificationController.getUnreadCount);

// Marcar una notificación como leída
router.patch('/:notificationId/read', notificationController.markAsRead);

// Marcar todas como leídas
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Crear notificación (para admins)
router.post('/', notificationController.createNotification);

// Endpoint de prueba
router.post('/test', notificationController.triggerTestNotification);

module.exports = router;