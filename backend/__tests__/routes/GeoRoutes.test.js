const request = require('supertest');
const express = require('express');

// Mock del controlador faltante ANTES de importar las rutas
jest.mock('../../controllers/GeoOfflineController', () => {
  return jest.fn().mockImplementation(() => ({
    getLocations: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
    createLocation: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
    updateLocation: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
    deleteLocation: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Deleted' })),
    getLocationById: jest.fn((req, res) => res.status(200).json({ success: true, data: {} }))
  }));
});

// Mock de auth middleware
jest.mock('../../middlewares/authMiddleware', () => 
  jest.fn((req, res, next) => {
    req.user = { id: 1 };
    next();
  })
);

// Ahora importamos las rutas después de mockear
const GeoRoutes = require('../../routes/GeoRoutes');

const app = express();
app.use(express.json());
app.use('/api/geo', GeoRoutes);

describe('Geo Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/geo/locations', () => {
    test('should get locations successfully', async () => {
      const response = await request(app)
        .get('/api/geo/locations')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/geo/locations', () => {
    test('should create location successfully', async () => {
      const locationData = {
        nombre: 'Test Location',
        latitud: 19.4326,
        longitud: -99.1332
      };

      const response = await request(app)
        .post('/api/geo/locations')
        .send(locationData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});