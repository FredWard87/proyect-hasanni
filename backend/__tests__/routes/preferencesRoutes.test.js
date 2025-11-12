const request = require('supertest');
const express = require('express');
const preferencesRoutes = require('../../routes/preferencesRoutes');
const preferencesController = require('../../controllers/preferencesController');
const authMiddleware = require('../../middlewares/authMiddleware');

// Mock de los controladores y middlewares
jest.mock('../../controllers/preferencesController');
jest.mock('../../middlewares/authMiddleware', () => 
  jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' }; // Mock user object
    next();
  })
);

const app = express();
app.use(express.json());
app.use('/api/preferences', preferencesRoutes);

describe('Preferences Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Middleware Authentication', () => {
    test('should apply auth middleware to all routes', async () => {
      preferencesController.getUserPreferences.mockImplementation((req, res) => {
        // Verificar que el middleware añadió el usuario
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(1);
        res.status(200).json({ success: true });
      });

      await request(app)
        .get('/api/preferences/')
        .expect(200);

      expect(authMiddleware).toHaveBeenCalled();
    });
  });

  describe('GET /api/preferences/', () => {
    test('should get user preferences successfully', async () => {
      const mockPreferences = {
        theme: 'dark',
        language: 'es',
        notifications: true,
        emailUpdates: false
      };

      preferencesController.getUserPreferences.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockPreferences
        });
      });

      const response = await request(app)
        .get('/api/preferences/')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.theme).toBe('dark');
      expect(response.body.data.language).toBe('es');
      expect(preferencesController.getUserPreferences).toHaveBeenCalledTimes(1);
    });

    test('should handle no preferences found', async () => {
      preferencesController.getUserPreferences.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Preferencias no encontradas'
        });
      });

      const response = await request(app)
        .get('/api/preferences/')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('no encontradas');
    });
  });

  describe('PUT /api/preferences/', () => {
    test('should update user preferences successfully', async () => {
      const updatedPreferences = {
        theme: 'light',
        language: 'en',
        notifications: false
      };

      preferencesController.updateUserPreferences.mockImplementation((req, res) => {
        expect(req.body).toEqual(updatedPreferences);
        res.status(200).json({
          success: true,
          message: 'Preferencias actualizadas correctamente',
          data: updatedPreferences
        });
      });

      const response = await request(app)
        .put('/api/preferences/')
        .send(updatedPreferences)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('actualizadas');
      expect(response.body.data.theme).toBe('light');
    });

    test('should handle validation errors in update', async () => {
      const invalidPreferences = {
        theme: 'invalid-theme' // tema inválido
      };

      preferencesController.updateUserPreferences.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Datos de preferencias inválidos'
        });
      });

      const response = await request(app)
        .put('/api/preferences/')
        .send(invalidPreferences)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('inválidos');
    });
  });

  describe('POST /api/preferences/reset', () => {
    test('should reset user preferences successfully', async () => {
      const defaultPreferences = {
        theme: 'system',
        language: 'es',
        notifications: true,
        emailUpdates: true
      };

      preferencesController.resetUserPreferences.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Preferencias restablecidas a los valores por defecto',
          data: defaultPreferences
        });
      });

      const response = await request(app)
        .post('/api/preferences/reset')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('restablecidas');
      expect(response.body.data.theme).toBe('system');
    });
  });

  describe('PUT /api/preferences/specific', () => {
    test('should update specific preference successfully', async () => {
      const specificUpdate = {
        key: 'theme',
        value: 'dark'
      };

      preferencesController.updateSpecificPreference.mockImplementation((req, res) => {
        expect(req.body.key).toBe('theme');
        expect(req.body.value).toBe('dark');
        res.status(200).json({
          success: true,
          message: 'Preferencia actualizada correctamente',
          data: { theme: 'dark' }
        });
      });

      const response = await request(app)
        .put('/api/preferences/specific')
        .send(specificUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.theme).toBe('dark');
    });

    test('should handle invalid preference key', async () => {
      const invalidUpdate = {
        key: 'invalid_key',
        value: 'some_value'
      };

      preferencesController.updateSpecificPreference.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Clave de preferencia no válida'
        });
      });

      const response = await request(app)
        .put('/api/preferences/specific')
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('no válida');
    });
  });

  describe('GET /api/preferences/export', () => {
    test('should export user preferences successfully', async () => {
      const mockExportData = {
        format: 'json',
        data: {
          theme: 'dark',
          language: 'es',
          notifications: true
        },
        exportedAt: '2024-01-01T00:00:00.000Z'
      };

      preferencesController.exportUserPreferences.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockExportData
        });
      });

      const response = await request(app)
        .get('/api/preferences/export')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('json');
      expect(response.body.data.data.theme).toBe('dark');
    });

    test('should support format query parameter', async () => {
      preferencesController.exportUserPreferences.mockImplementation((req, res) => {
        expect(req.query.format).toBe('csv');
        res.status(200).json({
          success: true,
          data: { format: 'csv', data: 'theme,language\ndark,es' }
        });
      });

      const response = await request(app)
        .get('/api/preferences/export?format=csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('csv');
    });
  });

  // Tests para verificar que todas las rutas están definidas
  describe('Route Existence', () => {
    test('should have all preferences routes defined', () => {
      const routes = [
        { method: 'GET', path: '/' },
        { method: 'PUT', path: '/' },
        { method: 'POST', path: '/reset' },
        { method: 'PUT', path: '/specific' },
        { method: 'GET', path: '/export' }
      ];

      routes.forEach(expectedRoute => {
        const routeExists = preferencesRoutes.stack.some(layer => {
          if (layer.route) {
            const path = layer.route.path;
            const methods = layer.route.methods;
            return path === expectedRoute.path && methods[expectedRoute.method.toLowerCase()];
          }
          return false;
        });
        
        expect(routeExists).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle server errors consistently', async () => {
      preferencesController.getUserPreferences.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor'
        });
      });

      const response = await request(app)
        .get('/api/preferences/')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Error interno');
    });
  });
});