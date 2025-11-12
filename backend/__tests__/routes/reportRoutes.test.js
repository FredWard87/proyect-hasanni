const request = require('supertest');
const express = require('express');
const reportRoutes = require('../../routes/reportRoutes');
const { query } = require('../../config/database');

// Mock de la base de datos
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

const app = express();
app.use(express.json());
app.use('/api/reports', reportRoutes);

describe('Report Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/reports/categories', () => {
    test('should get category report successfully', async () => {
      const mockCategories = [
        {
          categoria: 'Electrónicos',
          cantidad_productos: 5,
          total_stock: 150,
          promedio_stock: 30.00,
          valor_total: 7500.50
        },
        {
          categoria: 'Ropa',
          cantidad_productos: 3,
          total_stock: 80,
          promedio_stock: 26.67,
          valor_total: 2400.00
        }
      ];

      query.mockResolvedValue({
        rows: mockCategories
      });

      const response = await request(app)
        .get('/api/reports/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].categoria).toBe('Electrónicos');
      expect(response.body.data[0].cantidad_productos).toBe(5);
      expect(response.body.data[1].categoria).toBe('Ropa');
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(query).toHaveBeenCalledWith(expect.stringContaining('categoria'));
    });

    test('should handle database errors in categories report', async () => {
      query.mockRejectedValue(new Error('Error de base de datos'));

      const response = await request(app)
        .get('/api/reports/categories')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Error de base de datos');
    });

    test('should return empty array when no categories found', async () => {
      query.mockResolvedValue({
        rows: []
      });

      const response = await request(app)
        .get('/api/reports/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/reports/movements-by-period', () => {
    test('should get movements by period successfully with date parameters', async () => {
      const mockMovements = [
        {
          fecha_dia: '2024-01-01',
          tipo: 'entrada',
          cantidad_movimientos: 5,
          total_unidades: 150
        },
        {
          fecha_dia: '2024-01-01',
          tipo: 'salida',
          cantidad_movimientos: 3,
          total_unidades: 75
        }
      ];

      query.mockResolvedValue({
        rows: mockMovements
      });

      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const response = await request(app)
        .get(`/api/reports/movements-by-period?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].tipo).toBe('entrada');
      expect(response.body.data[1].tipo).toBe('salida');
      
      // Verificar que los parámetros se pasan correctamente a la consulta
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE fecha >= $1 AND fecha <= $2'),
        [startDate, endDate]
      );
    });

    test('should handle missing date parameters', async () => {
      query.mockRejectedValue(new Error('Parámetros de fecha requeridos'));

      const response = await request(app)
        .get('/api/reports/movements-by-period')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle database errors in movements report', async () => {
      query.mockRejectedValue(new Error('Error en consulta de movimientos'));

      const response = await request(app)
        .get('/api/reports/movements-by-period?startDate=2024-01-01&endDate=2024-01-31')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Error en consulta');
    });
  });

  describe('GET /api/reports/top-products', () => {
    test('should get top products with default parameters', async () => {
      const mockTopProducts = [
        {
          id: 1,
          codigo: 'PROD001',
          nombre: 'Producto A',
          categoria: 'Electrónicos',
          total_movimientos: 25,
          total_entradas: 150,
          total_salidas: 125,
          neto: 25
        },
        {
          id: 2,
          codigo: 'PROD002',
          nombre: 'Producto B',
          categoria: 'Ropa',
          total_movimientos: 18,
          total_entradas: 100,
          total_salidas: 90,
          neto: 10
        }
      ];

      query.mockResolvedValue({
        rows: mockTopProducts
      });

      const response = await request(app)
        .get('/api/reports/top-products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].total_movimientos).toBe(25);
      expect(response.body.data[1].total_movimientos).toBe(18);
      
      // Verificar que se usan los valores por defecto
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("CURRENT_DATE - INTERVAL '30 days'"),
        [10] // limit por defecto
      );
    });

    test('should get top products with custom parameters', async () => {
      const mockTopProducts = [
        {
          id: 1,
          codigo: 'PROD001',
          nombre: 'Producto A',
          total_movimientos: 15,
          total_entradas: 80,
          total_salidas: 70,
          neto: 10
        }
      ];

      query.mockResolvedValue({
        rows: mockTopProducts
      });

      const limit = 5;
      const days = 7;

      const response = await request(app)
        .get(`/api/reports/top-products?limit=${limit}&days=${days}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      // Verificar que se usan los parámetros personalizados
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("CURRENT_DATE - INTERVAL '7 days'"),
        [5] // limit personalizado
      );
    });

    test('should handle database errors in top products report', async () => {
      query.mockRejectedValue(new Error('Error en consulta de productos top'));

      const response = await request(app)
        .get('/api/reports/top-products')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Error en consulta');
    });

    test('should handle invalid limit parameter', async () => {
      // La consulta debería manejar límites inválidos
      query.mockResolvedValue({
        rows: []
      });

      const response = await request(app)
        .get('/api/reports/top-products?limit=invalid')
        .expect(200);

      expect(response.body.success).toBe(true);
      // La consulta podría fallar silenciosamente o la base de datos podría manejar el error
    });
  });

  describe('Route Structure', () => {
    test('should have all report routes defined', () => {
      const routes = [
        { method: 'GET', path: '/categories' },
        { method: 'GET', path: '/movements-by-period' },
        { method: 'GET', path: '/top-products' }
      ];

      routes.forEach(expectedRoute => {
        const routeExists = reportRoutes.stack.some(layer => {
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

  describe('Response Format Consistency', () => {
    test('should maintain consistent success response format', async () => {
      query.mockResolvedValue({
        rows: [{ categoria: 'Test', cantidad_productos: 1 }]
      });

      const response = await request(app)
        .get('/api/reports/categories')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should maintain consistent error response format', async () => {
      query.mockRejectedValue(new Error('Test error'));

      const response = await request(app)
        .get('/api/reports/categories')
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });
  });
});