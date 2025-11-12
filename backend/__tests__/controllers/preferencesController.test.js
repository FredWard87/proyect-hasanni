const request = require('supertest');
const express = require('express');
const preferencesController = require('../../controllers/preferencesController');
const { query } = require('../../config/database');

// Mock de dependencias
jest.mock('../../config/database');

const app = express();
app.use(express.json());

// Middleware de autenticación simulado
app.use((req, res, next) => {
  req.user = { userId: 1 };
  next();
});

app.get('/preferences', preferencesController.getUserPreferences);
app.put('/preferences', preferencesController.updateUserPreferences);
app.delete('/preferences/reset', preferencesController.resetUserPreferences);
app.patch('/preferences/specific', preferencesController.updateSpecificPreference);
app.get('/preferences/export', preferencesController.exportUserPreferences);

describe('Preferences Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /preferences', () => {
    test('should return user preferences with defaults', async () => {
      const mockUser = {
        id: 1,
        nombre: 'Test User',
        email: 'test@test.com',
        preferencias: {
          theme: 'dark',
          language: 'en'
        }
      };

      query.mockResolvedValue({
        rows: [mockUser]
      });

      const response = await request(app)
        .get('/preferences');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.theme).toBe('dark');
      expect(response.body.data.language).toBe('en');
      // Debería incluir valores por defecto para campos no establecidos
      expect(response.body.data.notifications).toBeDefined();
    });

    test('should return default preferences when user has none', async () => {
      const mockUser = {
        id: 1,
        nombre: 'Test User',
        email: 'test@test.com',
        preferencias: null
      };

      query.mockResolvedValue({
        rows: [mockUser]
      });

      const response = await request(app)
        .get('/preferences');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.theme).toBe('light'); // Valor por defecto
    });
  });

  describe('PUT /preferences', () => {
    test('should update user preferences successfully', async () => {
      const newPreferences = {
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          push: false,
          sms: true
        }
      };

      const currentUser = {
        id: 1,
        nombre: 'Test User',
        preferencias: {
          theme: 'light',
          language: 'es'
        }
      };

      query.mockResolvedValueOnce({
        rows: [currentUser]
      }).mockResolvedValueOnce({
        rows: [{ id: 1, nombre: 'Test User', preferencias: newPreferences }]
      });

      const response = await request(app)
        .put('/preferences')
        .send(newPreferences);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.theme).toBe('dark');
    });

    test('should reject invalid preference values', async () => {
      const invalidPreferences = {
        theme: 'invalid-theme', // Tema no válido
        language: 'en'
      };

      const response = await request(app)
        .put('/preferences')
        .send(invalidPreferences);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /preferences/specific', () => {
    test('should update specific preference successfully', async () => {
      const updateData = {
        category: 'notifications',
        key: 'email',
        value: false
      };

      const currentUser = {
        id: 1,
        preferencias: {
          theme: 'light',
          notifications: {
            email: true,
            push: false
          }
        }
      };

      query.mockResolvedValueOnce({
        rows: [currentUser]
      }).mockResolvedValueOnce({
        rows: [] // Para la actualización
      });

      const response = await request(app)
        .patch('/preferences/specific')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe(false);
    });

    test('should update nested preference with dot notation', async () => {
      const updateData = {
        category: 'privacy',
        key: 'showLocation',
        value: true
      };

      const currentUser = {
        id: 1,
        preferencias: {
          theme: 'light',
          privacy: {
            showLocation: false,
            showOnlineStatus: true
          }
        }
      };

      query.mockResolvedValueOnce({
        rows: [currentUser]
      });

      const response = await request(app)
        .patch('/preferences/specific')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /preferences/reset', () => {
    test('should reset preferences to default values', async () => {
      const currentUser = {
        id: 1,
        nombre: 'Test User',
        email: 'test@test.com',
        preferencias: {
          theme: 'dark',
          language: 'en',
          customSetting: 'should-be-removed'
        }
      };

      query.mockResolvedValue({
        rows: [currentUser]
      });

      const response = await request(app)
        .delete('/preferences/reset');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.theme).toBe('light'); // Valor por defecto
    });
  });

  describe('GET /preferences/export', () => {
    test('should export user preferences as JSON', async () => {
      const mockUser = {
        nombre: 'Test User',
        email: 'test@test.com',
        fecha_creacion: new Date(),
        preferencias: {
          theme: 'dark',
          language: 'en'
        }
      };

      query.mockResolvedValue({
        rows: [mockUser]
      });

      const response = await request(app)
        .get('/preferences/export');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.nombre).toBe('Test User');
      expect(response.body.data.preferences.theme).toBe('dark');
    });
  });
});