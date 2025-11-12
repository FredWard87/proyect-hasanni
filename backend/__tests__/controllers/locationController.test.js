const request = require('supertest');
const express = require('express');
const LocationController = require('../../controllers/locationController');
const { query } = require('../../config/database');

// Mock de dependencias
jest.mock('../../config/database');

const app = express();
app.use(express.json());

// Middleware de autenticación simulado
app.use((req, res, next) => {
  req.user = { userId: 1, rol: 'admin' }; // Por defecto admin para pruebas
  next();
});

app.post('/location/update', LocationController.updateLocation);
app.get('/location/my-location', LocationController.getMyLocation);
app.get('/location/nearby-users', LocationController.getNearbyUsers);
app.get('/location/stats', LocationController.getLocationStats);
app.delete('/location', LocationController.deleteLocation);

describe('Location Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /location/update', () => {
    test('should update location with valid coordinates', async () => {
      const locationData = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        timestamp: new Date().toISOString()
      };

      query.mockResolvedValue({
        rows: [{
          id: 1,
          nombre: 'Test User',
          current_latitude: locationData.latitude,
          current_longitude: locationData.longitude,
          last_location_update: new Date()
        }]
      });

      const response = await request(app)
        .post('/location/update')
        .send(locationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.latitude).toBe(locationData.latitude);
    });

    test('should reject invalid coordinates', async () => {
      const locationData = {
        latitude: 100, // Latitud inválida
        longitude: -74.0060
      };

      const response = await request(app)
        .post('/location/update')
        .send(locationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /location/my-location', () => {
    test('should return user location when available', async () => {
      const mockLocation = {
        id: 1,
        nombre: 'Test User',
        current_latitude: 40.7128,
        current_longitude: -74.0060,
        accuracy: 10,
        last_location_update: new Date()
      };

      query.mockResolvedValue({
        rows: [mockLocation]
      });

      const response = await request(app)
        .get('/location/my-location');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.latitude).toBe(mockLocation.current_latitude);
    });

    test('should return 404 when no location set', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 1,
          nombre: 'Test User',
          current_latitude: null,
          current_longitude: null
        }]
      });

      const response = await request(app)
        .get('/location/my-location');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /location/nearby-users', () => {
    test('should return nearby users for admin', async () => {
      const mockUsers = [
        {
          id: 1,
          nombre: 'User 1',
          current_latitude: 40.7128,
          current_longitude: -74.0060
        },
        {
          id: 2,
          nombre: 'User 2',
          current_latitude: 40.7138,
          current_longitude: -74.0070
        }
      ];

      query.mockResolvedValue({
        rows: mockUsers
      });

      const response = await request(app)
        .get('/location/nearby-users')
        .query({ radius: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    test('should reject non-admin users', async () => {
      // Sobrescribir middleware para este test
      const nonAdminApp = express();
      nonAdminApp.use(express.json());
      nonAdminApp.use((req, res, next) => {
        req.user = { userId: 1, rol: 'lector' }; // Rol no admin
        next();
      });
      nonAdminApp.get('/location/nearby-users', LocationController.getNearbyUsers);

      const response = await request(nonAdminApp)
        .get('/location/nearby-users');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});