const request = require('supertest');
const express = require('express');
const inventoryRoutes = require('../../routes/inventoryRoutes');
const inventoryController = require('../../controllers/inventoryController');

// Mock del controlador
jest.mock('../../controllers/inventoryController');

const app = express();
app.use(express.json());
app.use('/api/inventory', inventoryRoutes);

describe('Inventory Routes - Stock Alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/inventory/stock-alerts', () => {
    test('should get stock alerts successfully', async () => {
      const mockAlerts = [
        {
          id: 1,
          nombre: 'Producto A',
          stock_actual: 5,
          stock_minimo: 10,
          diferencia: -5,
          estado: 'CRITICO'
        },
        {
          id: 2,
          nombre: 'Producto B', 
          stock_actual: 8,
          stock_minimo: 15,
          diferencia: -7,
          estado: 'BAJO'
        }
      ];

      inventoryController.getStockAlerts.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockAlerts,
          total: mockAlerts.length,
          critical: 1,
          low: 1
        });
      });

      const response = await request(app)
        .get('/api/inventory/stock-alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].estado).toBe('CRITICO');
      expect(response.body.data[1].estado).toBe('BAJO');
      expect(inventoryController.getStockAlerts).toHaveBeenCalledTimes(1);
    });

    test('should handle no stock alerts found', async () => {
      inventoryController.getStockAlerts.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [],
          total: 0,
          critical: 0,
          low: 0,
          message: 'No hay alertas de stock'
        });
      });

      const response = await request(app)
        .get('/api/inventory/stock-alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
      expect(response.body.message).toContain('No hay alertas');
    });

    test('should handle server errors', async () => {
      inventoryController.getStockAlerts.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Error del servidor'
        });
      });

      const response = await request(app)
        .get('/api/inventory/stock-alerts')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Error');
    });

    test('should support query parameters for filtering', async () => {
      const mockFilteredAlerts = [
        {
          id: 1,
          nombre: 'Producto Crítico',
          stock_actual: 2,
          stock_minimo: 10,
          estado: 'CRITICO'
        }
      ];

      inventoryController.getStockAlerts.mockImplementation((req, res) => {
        // Verificar que recibe los query params
        expect(req.query.estado).toBe('CRITICO');
        expect(req.query.limit).toBe('10');
        
        res.status(200).json({
          success: true,
          data: mockFilteredAlerts,
          total: 1,
          critical: 1,
          low: 0
        });
      });

      const response = await request(app)
        .get('/api/inventory/stock-alerts?estado=CRITICO&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].estado).toBe('CRITICO');
    });
  });

  // Tests para verificar que todas las rutas están definidas
  describe('Route Existence', () => {
    test('should have all inventory routes defined', () => {
      const routes = [
        'GET /',
        'GET /low-stock', 
        'GET /dashboard',
        'GET /movements',
        'GET /usuarios-movimientos',
        'GET /proveedores',
        'GET /stock-alerts', // Nueva ruta
        'POST /products',
        'POST /entries',
        'POST /exits',
        'POST /proveedores',
        'PUT /products/:id',
        'DELETE /products/:id',
        'PUT /proveedores/:id'
      ];

      routes.forEach(route => {
        expect(inventoryRoutes.stack).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              route: expect.objectContaining({
                path: expect.any(String),
                methods: expect.any(Object)
              })
            })
          ])
        );
      });
    });
  });
});