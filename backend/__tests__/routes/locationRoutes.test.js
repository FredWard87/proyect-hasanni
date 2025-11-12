const request = require('supertest');
const express = require('express');
const locationRoutes = require('../../routes/locationRoutes');
const locationController = require('../../controllers/locationController');

// Mock del controlador
jest.mock('../../controllers/locationController');

const app = express();
app.use(express.json());
app.use('/api/location', locationRoutes);

describe('Location Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/location/ubicacion', () => {
    test('should update user location successfully', async () => {
      const locationData = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 15,
        timestamp: new Date().toISOString()
      };

      locationController.updateLocation.mockImplementation((req, res) => {
        expect(req.body).toEqual(locationData);
        res.status(200).json({
          success: true,
          message: 'Ubicación actualizada correctamente',
          location: locationData
        });
      });

      const response = await request(app)
        .post('/api/location/ubicacion')
        .send(locationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('actualizada');
      expect(locationController.updateLocation).toHaveBeenCalledTimes(1);
    });

    test('should handle location update errors', async () => {
      locationController.updateLocation.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Datos de ubicación inválidos'
        });
      });

      const response = await request(app)
        .post('/api/location/ubicacion')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('inválidos');
    });
  });

  describe('GET /api/location/mi-ubicacion', () => {
    test('should get current user location', async () => {
      const mockLocation = {
        latitude: 40.7128,
        longitude: -74.0060,
        lastUpdate: new Date().toISOString()
      };

      locationController.getMyLocation.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockLocation
        });
      });

      const response = await request(app)
        .get('/api/location/mi-ubicacion')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.latitude).toBe(40.7128);
      expect(locationController.getMyLocation).toHaveBeenCalledTimes(1);
    });

    test('should handle no location found', async () => {
      locationController.getMyLocation.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'No se encontró ubicación para el usuario'
        });
      });

      const response = await request(app)
        .get('/api/location/mi-ubicacion')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No se encontró');
    });
  });

  describe('GET /api/location/cercanos', () => {
    test('should get nearby users with filters', async () => {
      const mockNearbyUsers = [
        { id: 2, nombre: 'Usuario 1', distance: 0.3 },
        { id: 3, nombre: 'Usuario 2', distance: 0.8 }
      ];

      locationController.getNearbyUsers.mockImplementation((req, res) => {
        expect(req.query.radio).toBe('500');
        expect(req.query.limite).toBe('20');
        res.status(200).json({
          success: true,
          data: mockNearbyUsers,
          total: 2
        });
      });

      const response = await request(app)
        .get('/api/location/cercanos?radio=500&limite=20')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });
  });

  describe('GET /api/location/estadisticas-ubicacion', () => {
    test('should get location statistics', async () => {
      const mockStats = {
        totalUsuarios: 50,
        usuariosActivos: 25,
        ubicacionesHoy: 150,
        promedioDistancia: 2.3
      };

      locationController.getLocationStats.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockStats
        });
      });

      const response = await request(app)
        .get('/api/location/estadisticas-ubicacion')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUsuarios).toBe(50);
    });
  });

  describe('DELETE /api/location/ubicacion', () => {
    test('should delete user location', async () => {
      locationController.deleteLocation.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Ubicación eliminada correctamente'
        });
      });

      const response = await request(app)
        .delete('/api/location/ubicacion')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('eliminada');
      expect(locationController.deleteLocation).toHaveBeenCalledTimes(1);
    });

    test('should handle delete location errors', async () => {
      locationController.deleteLocation.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Error eliminando ubicación'
        });
      });

      const response = await request(app)
        .delete('/api/location/ubicacion')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Route Configuration', () => {
    test('should have all location routes defined', () => {
      const expectedRoutes = [
        { method: 'POST', path: '/ubicacion' },
        { method: 'GET', path: '/mi-ubicacion' },
        { method: 'GET', path: '/cercanos' },
        { method: 'GET', path: '/estadisticas-ubicacion' },
        { method: 'DELETE', path: '/ubicacion' }
      ];

      expectedRoutes.forEach(expectedRoute => {
        const routeExists = locationRoutes.stack.some(layer => {
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

    test('should not have duplicate middleware', () => {
      // Verificar que no hay middleware duplicado
      const middlewareCount = locationRoutes.stack.filter(layer => 
        layer.name === 'authMiddleware' || layer.handle?.name === 'authMiddleware'
      ).length;

      expect(middlewareCount).toBe(0); // No debería tener middleware en estas rutas
    });
  });
});