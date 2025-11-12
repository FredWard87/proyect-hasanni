const request = require('supertest');
const express = require('express');
const ExcelReportController = require('../../controllers/excelReportController');
const excelReportService = require('../../services/excelReportService');

// Mock de dependencias
jest.mock('../../services/excelReportService');

const app = express();
app.use(express.json());

// Middleware de autenticación simulado
app.use((req, res, next) => {
  req.user = { userId: 1, nombre: 'Test User', email: 'test@test.com' };
  next();
});

app.get('/reports/inventory', ExcelReportController.generateInventoryReport);
app.get('/reports/movements', ExcelReportController.generateMovementsReport);
app.get('/reports/top-products', ExcelReportController.generateTopProductsReport);
app.get('/reports/full-system', ExcelReportController.generateFullSystemReport);

describe('Excel Report Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /reports/inventory', () => {
    test('should generate inventory report successfully', async () => {
      const mockWorkbook = {
        xlsx: {
          write: jest.fn().mockImplementation((res) => {
            res.end();
          })
        }
      };

      excelReportService.generateInventoryReport.mockResolvedValue(mockWorkbook);

      const response = await request(app)
        .get('/reports/inventory')
        .query({
          incluir_stock_bajo: 'true',
          incluir_metricas: 'true'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    test('should validate query parameters', async () => {
      const response = await request(app)
        .get('/reports/inventory')
        .query({
          incluir_stock_bajo: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /reports/movements', () => {
    test('should generate movements report with valid dates', async () => {
      const mockWorkbook = {
        xlsx: {
          write: jest.fn().mockImplementation((res) => {
            res.end();
          })
        }
      };

      excelReportService.generateMovementsReport.mockResolvedValue(mockWorkbook);

      const response = await request(app)
        .get('/reports/movements')
        .query({
          fecha_inicio: '2024-01-01',
          fecha_fin: '2024-01-31'
        });

      expect(response.status).toBe(200);
    });

    test('should reject invalid date format', async () => {
      const response = await request(app)
        .get('/reports/movements')
        .query({
          fecha_inicio: 'invalid-date',
          fecha_fin: '2024-01-31'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject date range over 2 years', async () => {
      const response = await request(app)
        .get('/reports/movements')
        .query({
          fecha_inicio: '2020-01-01',
          fecha_fin: '2024-01-31'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /reports/top-products', () => {
    test('should generate top products report with valid parameters', async () => {
      const mockWorkbook = {
        xlsx: {
          write: jest.fn().mockImplementation((res) => {
            res.end();
          })
        }
      };

      excelReportService.generateTopProductsReport.mockResolvedValue(mockWorkbook);

      const response = await request(app)
        .get('/reports/top-products')
        .query({
          dias: 30,
          limite: 10
        });

      expect(response.status).toBe(200);
    });

    test('should validate numeric parameters', async () => {
      const response = await request(app)
        .get('/reports/top-products')
        .query({
          dias: 'invalid',
          limite: 10
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});