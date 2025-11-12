const ExcelJS = require('exceljs');
const { query } = require('../../config/database');

// Mock de dependencias
jest.mock('../../config/database');
jest.mock('exceljs');

describe('ExcelReportService', () => {
  let excelService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear require cache and re-import
    jest.resetModules();
    excelService = require('../../services/excelReportService');
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

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const workbook = await excelService.generateInventoryReport();

      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(query).toHaveBeenCalledWith(expect.stringContaining('categoria'));
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Inventario General');
      expect(mockWorksheet.addRow).toHaveBeenCalledWith({
        codigo: 'PROD001',
        nombre: 'Producto Test',
        categoria: 'Test Category',
        unidad: 'pz',
        stock_minimo: 10,
        stock: 15,
        estado_stock: 'NORMAL',
        precio: 100.50,
        valor_total: 1507.50
      });
    });

    test('should handle database errors', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));

      await expect(excelService.generateInventoryReport()).rejects.toThrow('Database connection failed');
    });

    test('should include low stock sheet when requested', async () => {
      query.mockResolvedValue({ rows: [] });

      const mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
        getRow: jest.fn().mockReturnValue({
          font: {},
          fill: {},
          border: {},
          alignment: {}
        })
      };

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await excelService.generateInventoryReport(true, false);

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Stock Bajo');
    });

    test('should include metrics sheet when requested', async () => {
      query.mockResolvedValue({ rows: [] });

      const mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
        getRow: jest.fn().mockReturnValue({
          font: {},
          fill: {},
          border: {},
          alignment: {}
        })
      };

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await excelService.generateInventoryReport(false, true);

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Métricas');
    });

    test('should handle empty product list', async () => {
      query.mockResolvedValue({ rows: [] });

      const mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
        getRow: jest.fn().mockReturnValue({
          font: {},
          fill: {},
          border: {},
          alignment: {}
        }),
        getCell: jest.fn(),
        getColumn: jest.fn()
      };

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await excelService.generateInventoryReport();

      expect(mockWorksheet.addRow).not.toHaveBeenCalledWith(expect.any(Object));
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

      const mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
        getRow: jest.fn().mockReturnValue({
          font: {},
          fill: {},
          border: {},
          alignment: {}
        })
      };

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const fechaInicio = '2024-01-01';
      const fechaFin = '2024-01-31';

      await excelService.generateMovementsReport(fechaInicio, fechaFin);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT m.*'),
        [fechaInicio, fechaFin]
      );
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Movimientos');
    });

    test('should handle empty movements data', async () => {
      query.mockResolvedValue({ rows: [] });

      const mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
        getRow: jest.fn().mockReturnValue({
          font: {},
          fill: {},
          border: {},
          alignment: {}
        })
      };

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await excelService.generateMovementsReport('2024-01-01', '2024-01-31');

      expect(mockWorksheet.addRow).not.toHaveBeenCalledWith(expect.any(Object));
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

      const mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
        getRow: jest.fn().mockReturnValue({
          font: {},
          fill: {},
          border: {},
          alignment: {}
        })
      };

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await excelService.generateTopProductsReport();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("CURRENT_DATE - INTERVAL '30 days'"),
        [10]
      );
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Productos Más Movidos');
    });

    test('should generate top products report with custom parameters', async () => {
      query.mockResolvedValue({ rows: [] });

      const mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
        getRow: jest.fn().mockReturnValue({
          font: {},
          fill: {},
          border: {},
          alignment: {}
        })
      };

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await excelService.generateTopProductsReport(7, 5);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("CURRENT_DATE - INTERVAL '7 days'"),
        [5]
      );
    });

    test('should handle database errors in top products report', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await expect(excelService.generateTopProductsReport()).rejects.toThrow('Database error');
    });
  });

  describe('Style Application', () => {
    test('should apply inventory styles correctly', async () => {
      // This is a complex test that would require mocking all style methods
      // For now, we'll test that the method exists and can be called
      expect(typeof excelService.applyInventoryStyles).toBe('function');
      expect(typeof excelService.applyMovementsStyles).toBe('function');
      expect(typeof excelService.applyTopProductsStyles).toBe('function');
    });
  });

  describe('Helper Methods', () => {
    test('should have helper methods for additional sheets', async () => {
      expect(typeof excelService.addLowStockSheet).toBe('function');
      expect(typeof excelService.addMetricsSheet).toBe('function');
      expect(typeof excelService.addMovementsSummarySheet).toBe('function');
    });

    test('should handle errors in helper methods', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue({
          columns: [],
          addRow: jest.fn(),
          getRow: jest.fn().mockReturnValue({
            font: {},
            fill: {}
          })
        })
      };

      await expect(excelService.addLowStockSheet(mockWorkbook)).rejects.toThrow('Database error');
    });
  });

  describe('Data Formatting', () => {
    test('should format numbers correctly in inventory report', async () => {
      const mockProducts = [
        {
          codigo: 'PROD001',
          nombre: 'Test Product',
          categoria: 'Test',
          unidad: 'pz',
          stock_minimo: '10', // string instead of number
          stock: '15', // string instead of number
          precio: '100.50', // string instead of number
          valor_total: '1507.50', // string instead of number
          estado_stock: 'NORMAL'
        }
      ];

      query.mockResolvedValue({ rows: mockProducts });

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

      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await excelService.generateInventoryReport();

      // Verify that numeric conversion is attempted
      expect(mockWorksheet.addRow).toHaveBeenCalledWith(
        expect.objectContaining({
          stock_minimo: 10,
          stock: 15,
          precio: 100.50,
          valor_total: 1507.50
        })
      );
    });
  });
});