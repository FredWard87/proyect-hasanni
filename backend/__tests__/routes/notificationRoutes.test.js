const request = require('supertest');
const express = require('express');
const notificationRoutes = require('../../routes/notificationRoutes');
const notificationController = require('../../controllers/notificationController');
const authMiddleware = require('../../middlewares/authMiddleware');

// Mock de dependencias
jest.mock('../../controllers/notificationController');
jest.mock('../../middlewares/authMiddleware');

// Mock del middleware
authMiddleware.mockImplementation((req, res, next) => {
  req.user = { userId: 1, rol: 'user' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationRoutes);

describe('Notification Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    test('should get user notifications with auth', async () => {
      const mockNotifications = [
        { id: 1, titulo: 'Notificación 1', leida: false },
        { id: 2, titulo: 'Notificación 2', leida: true }
      ];

      notificationController.getUserNotifications.mockImplementation((req, res) => {
        expect(req.user.userId).toBe(1);
        res.status(200).json({
          success: true,
          data: mockNotifications,
          total: 2
        });
      });

      const response = await request(app)
        .get('/api/notifications')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(notificationController.getUserNotifications).toHaveBeenCalledTimes(1);
    });

    test('should support pagination parameters', async () => {
      notificationController.getUserNotifications.mockImplementation((req, res) => {
        expect(req.query.page).toBe('1');
        expect(req.query.limit).toBe('10');
        res.status(200).json({
          success: true,
          data: [],
          total: 0
        });
      });

      await request(app)
        .get('/api/notifications?page=1&limit=10')
        .expect(200);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    test('should get unread notifications count', async () => {
      notificationController.getUnreadCount.mockImplementation((req, res) => {
        expect(req.user.userId).toBe(1);
        res.status(200).json({
          success: true,
          count: 5
        });
      });

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(5);
    });
  });

  describe('PATCH /api/notifications/:notificationId/read', () => {
    test('should mark notification as read', async () => {
      notificationController.markAsRead.mockImplementation((req, res) => {
        expect(req.params.notificationId).toBe('123');
        expect(req.user.userId).toBe(1);
        res.status(200).json({
          success: true,
          message: 'Notificación marcada como leída'
        });
      });

      const response = await request(app)
        .patch('/api/notifications/123/read')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('leída');
    });

    test('should handle invalid notification ID', async () => {
      notificationController.markAsRead.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      });

      const response = await request(app)
        .patch('/api/notifications/invalid-id/read')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/notifications/mark-all-read', () => {
    test('should mark all notifications as read', async () => {
      notificationController.markAllAsRead.mockImplementation((req, res) => {
        expect(req.user.userId).toBe(1);
        res.status(200).json({
          success: true,
          message: 'Todas las notificaciones marcadas como leídas',
          updated: 10
        });
      });

      const response = await request(app)
        .patch('/api/notifications/mark-all-read')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(10);
    });
  });

  describe('POST /api/notifications', () => {
    test('should create notification (admin only)', async () => {
      // Simular usuario admin
      authMiddleware.mockImplementationOnce((req, res, next) => {
        req.user = { userId: 1, rol: 'admin' };
        next();
      });

      const notificationData = {
        titulo: 'Nueva notificación',
        mensaje: 'Este es un mensaje de prueba',
        tipo: 'sistema',
        usuarios: [2, 3, 4]
      };

      notificationController.createNotification.mockImplementation((req, res) => {
        expect(req.user.rol).toBe('admin');
        expect(req.body).toEqual(notificationData);
        res.status(201).json({
          success: true,
          message: 'Notificación creada exitosamente',
          notification: { id: 100, ...notificationData }
        });
      });

      const response = await request(app)
        .post('/api/notifications')
        .send(notificationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.notification.id).toBe(100);
    });
  });

  describe('POST /api/notifications/test', () => {
    test('should trigger test notification', async () => {
      notificationController.triggerTestNotification.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Notificación de prueba enviada'
        });
      });

      const response = await request(app)
        .post('/api/notifications/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('prueba');
    });
  });

  describe('Authentication', () => {
    test('should apply auth middleware to all routes', () => {
      expect(authMiddleware).toHaveBeenCalled();
    });
  });

  describe('Route Configuration', () => {
    test('should have all notification routes defined', () => {
      const expectedRoutes = [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/unread-count' },
        { method: 'PATCH', path: '/:notificationId/read' },
        { method: 'PATCH', path: '/mark-all-read' },
        { method: 'POST', path: '/' },
        { method: 'POST', path: '/test' }
      ];

      expectedRoutes.forEach(expectedRoute => {
        const routeExists = notificationRoutes.stack.some(layer => {
          if (layer.route) {
            const path = layer.route.path;
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
            return path === expectedRoute.path && methods.includes(expectedRoute.method);
          }
          return false;
        });

        expect(routeExists).toBe(true);
      });
    });
  });
});