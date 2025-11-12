// Mock de dependencias ANTES de importar el servicio
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

jest.mock('exceljs', () => {
  const mockWorksheet = {
    columns: [],
    addRow: jest.fn(),
    getRow: jest.fn().mockReturnValue({
      font: {},
      fill: {},
      border: {},
      alignment: {}
    }),
    getCell: jest.fn().mockReturnValue({
      value: 'NORMAL',
      fill: {}
    }),
    getColumn: jest.fn().mockReturnValue({
      numFmt: ''
    })
  };

  return {
    Workbook: jest.fn().mockImplementation(() => ({
      addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
    }))
  };
});

const ExcelJS = require('exceljs');
const { query } = require('../../config/database');

// Ahora importamos el servicio después de mockear
const ExcelReportService = require('../../services/excelReportService');

describe('ExcelReportService', () => {
  let excelService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reiniciar la instancia del servicio
    jest.isolateModules(() => {
      excelService = require('../../services/excelReportService');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateInventoryReport', () => {
    test('should generate inventory report with correct structure', async () => {
      const mockProducts = [
        {
          codigo: 'PROD001',
          nombre: 'Producto Test',
          categoria: 'Test Category',
          unidad: 'pz',
          stock_minimo: 10,
          stock: 15,
          precio: 100.50,
          valor_total: 1507.50,
          estado_stock: 'NORMAL'
        }
      ];

      query.mockResolvedValue({ rows: mockProducts });

      const workbook = await excelService.generateInventoryReport();

      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(ExcelJS.Workbook).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));

      await expect(excelService.generateInventoryReport()).rejects.toThrow('Database connection failed');
    });
  });

  describe('generateMovementsReport', () => {
    test('should generate movements report with date range', async () => {
      const mockMovements = [
        {
          fecha: new Date('2024-01-01'),
          tipo: 'entrada',
          codigo: 'PROD001',
          producto: 'Producto Test',
          categoria: 'Test Category',
          cantidad: 10,
          referencia: 'REF001',
          documento: 'DOC001',
          responsable: 'Test User',
          proveedor_cliente: 'Proveedor Test',
          observaciones: 'Test observations'
        }
      ];

      query.mockResolvedValue({ rows: mockMovements });

      const fechaInicio = '2024-01-01';
      const fechaFin = '2024-01-31';

      await excelService.generateMovementsReport(fechaInicio, fechaFin);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT m.*'),
        [fechaInicio, fechaFin]
      );
    });
  });

  describe('generateTopProductsReport', () => {
    test('should generate top products report with default parameters', async () => {
      const mockTopProducts = [
        {
          codigo: 'PROD001',
          producto: 'Top Product',
          categoria: 'Test Category',
          total_movimientos: 25,
          total_entradas: 150,
          total_salidas: 125,
          neto: 25,
          stock: 30
        }
      ];

      query.mockResolvedValue({ rows: mockTopProducts });

      await excelService.generateTopProductsReport();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("CURRENT_DATE - INTERVAL '30 days'"),
        [10]
      );
    });
  });
});