// Mock de la base de datos ANTES de importar el servicio
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

const { query } = require('../../config/database');

// Ahora importamos el servicio después de mockear
const InventoryService = require('../../services/inventoryService');

describe('InventoryService', () => {
  let inventoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reiniciar la instancia del servicio
    jest.isolateModules(() => {
      inventoryService = require('../../services/inventoryService');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Product Operations', () => {
    test('should get all active products', async () => {
      const mockProducts = [
        { id: 1, nombre: 'Producto 1', activo: true },
        { id: 2, nombre: 'Producto 2', activo: true }
      ];

      query.mockResolvedValue({ rows: mockProducts });

      const result = await inventoryService.getAllProducts();

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM productos WHERE activo = true ORDER BY nombre'
      );
      expect(result).toEqual(mockProducts);
    });

    test('should get product by ID', async () => {
      const mockProduct = { id: 1, nombre: 'Producto Test', activo: true };
      query.mockResolvedValue({ rows: [mockProduct] });

      const result = await inventoryService.getProductById(1);

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM productos WHERE id = $1 AND activo = true',
        [1]
      );
      expect(result).toEqual(mockProduct);
    });

    test('should return undefined for non-existent product', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await inventoryService.getProductById(999);

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM productos WHERE id = $1 AND activo = true',
        [999]
      );
      expect(result).toBeUndefined();
    });

    test('should create new product', async () => {
      const productData = {
        codigo: 'TEST001',
        nombre: 'Nuevo Producto',
        descripcion: 'Descripción test',
        categoria: 'Test',
        unidad: 'pz',
        stock_minimo: 10,
        precio: 100.50,
        stock: 20
      };

      const mockCreatedProduct = { id: 1, ...productData };
      query.mockResolvedValue({ rows: [mockCreatedProduct] });

      const result = await inventoryService.createProduct(productData);

      expect(query).toHaveBeenCalledWith(
        `INSERT INTO productos 
         (codigo, nombre, descripcion, categoria, unidad, stock_minimo, precio, stock, activo) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          'TEST001', 'Nuevo Producto', 'Descripción test', 'Test', 'pz',
          10, 100.50, 20, true
        ]
      );
      expect(result).toEqual(mockCreatedProduct);
    });

    test('should update product', async () => {
      const updateData = { nombre: 'Producto Actualizado', precio: 150 };
      const mockUpdatedProduct = { id: 1, ...updateData };
      
      query.mockResolvedValue({ rows: [mockUpdatedProduct] });

      const result = await inventoryService.updateProduct(1, updateData);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE productos'),
        expect.arrayContaining(['Producto Actualizado', 150, 1])
      );
      expect(result).toEqual(mockUpdatedProduct);
    });

    test('should delete product (soft delete)', async () => {
      const mockDeletedProduct = { id: 1, activo: false };
      query.mockResolvedValue({ rows: [mockDeletedProduct] });

      const result = await inventoryService.deleteProduct(1);

      expect(query).toHaveBeenCalledWith(
        'UPDATE productos SET activo = false, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [1]
      );
      expect(result).toEqual(mockDeletedProduct);
    });
  });

  describe('Inventory Operations', () => {
    test('should get inventory with default filters', async () => {
      const mockInventory = [
        { id: 1, nombre: 'Producto 1', estado_stock: 'NORMAL' }
      ];

      query.mockResolvedValue({ rows: mockInventory });

      const result = await inventoryService.getInventory();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM vista_inventario WHERE 1=1 AND activo = true'),
        []
      );
      expect(result).toEqual(mockInventory);
    });

    test('should get low stock products', async () => {
      const mockLowStock = [
        { id: 1, nombre: 'Producto Bajo Stock', stock: 5, stock_minimo: 10 }
      ];

      query.mockResolvedValue({ rows: mockLowStock });

      const result = await inventoryService.getLowStockProducts();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE stock < stock_minimo AND activo = true'),
        []
      );
      expect(result).toEqual(mockLowStock);
    });
  });

  describe('Movement Operations', () => {
    test('should register movement', async () => {
      const movementData = {
        tipo: 'entrada',
        id_producto: 1,
        cantidad: 10,
        referencia: 'REF001',
        documento: 'DOC001',
        responsable: 'Test User',
        id_proveedor: 1,
        id_usuario: 1,
        observaciones: 'Test movement'
      };

      const mockMovement = { id: 1, ...movementData };
      query.mockResolvedValue({ rows: [mockMovement] });

      const result = await inventoryService.registerMovement(movementData);

      expect(query).toHaveBeenCalledWith(
        `INSERT INTO movimientos_inventario 
         (tipo, id_producto, cantidad, referencia, documento, responsable, id_proveedor, id_usuario, observaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          'entrada', 1, 10, 'REF001', 'DOC001', 'Test User',
          1, 1, 'Test movement'
        ]
      );
      expect(result).toEqual(mockMovement);
    });

    test('should get movements with filters', async () => {
      const mockMovements = [
        { id: 1, tipo: 'entrada', cantidad: 10 }
      ];

      query.mockResolvedValue({ rows: mockMovements });

      const filters = {
        tipo: 'entrada',
        fecha_desde: '2024-01-01',
        fecha_hasta: '2024-01-31',
        limit: 50
      };

      const result = await inventoryService.getMovimientos(filters);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT m.*'),
        ['entrada', '2024-01-01', '2024-01-31', 50]
      );
      expect(result).toEqual(mockMovements);
    });
  });

  describe('Dashboard Data', () => {
    test('should get dashboard data', async () => {
      const mockResumen = {
        total_productos: 100,
        productos_stock_bajo: 5,
        productos_sin_stock: 2,
        stock_promedio: 25.5,
        valor_total_inventario: 50000
      };

      const mockLowStock = [{ id: 1, nombre: 'Low Stock Product' }];
      const mockRecentMovements = [{ id: 1, tipo: 'entrada' }];

      // Mock de las consultas
      query.mockResolvedValueOnce({ rows: [mockResumen] });
      
      // Mock de los métodos internos
      const originalGetLowStock = inventoryService.getLowStockProducts;
      const originalGetMovimientos = inventoryService.getMovimientos;
      
      inventoryService.getLowStockProducts = jest.fn().mockResolvedValue(mockLowStock);
      inventoryService.getMovimientos = jest.fn().mockResolvedValue(mockRecentMovements);

      const result = await inventoryService.getDashboardData();

      expect(result).toEqual({
        resumen: mockResumen,
        lowStock: mockLowStock,
        recentMovements: mockRecentMovements
      });

      // Restaurar métodos originales
      inventoryService.getLowStockProducts = originalGetLowStock;
      inventoryService.getMovimientos = originalGetMovimientos;
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors in getAllProducts', async () => {
      const error = new Error('Database connection failed');
      query.mockRejectedValue(error);

      await expect(inventoryService.getAllProducts()).rejects.toThrow('Database connection failed');
    });
  });
});