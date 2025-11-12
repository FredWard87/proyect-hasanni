const request = require('supertest');
const express = require('express');
const InventoryController = require('../../controllers/inventoryController');
const inventoryService = require('../../services/inventoryService');
const { query } = require('../../config/database');

// Mock de dependencias
jest.mock('../../services/inventoryService');
jest.mock('../../config/database');

const app = express();
app.use(express.json());

// Middleware de autenticación simulado
app.use((req, res, next) => {
  req.user = { userId: 1 };
  next();
});

app.get('/inventory', InventoryController.getInventory);
app.get('/inventory/low-stock', InventoryController.getLowStock);
app.post('/inventory/products', InventoryController.createProduct);
app.post('/inventory/entries', InventoryController.registerEntry);
app.post('/inventory/exits', InventoryController.registerExit);
app.get('/inventory/movements', InventoryController.getMovements);
app.get('/inventory/dashboard', InventoryController.getDashboard);
app.put('/inventory/products/:id', InventoryController.updateProduct);
app.delete('/inventory/products/:id', InventoryController.deleteProduct);
app.get('/inventory/usuarios-movimientos', InventoryController.getUsuariosParaMovimientos);
app.get('/inventory/proveedores', InventoryController.getProveedores);
app.post('/inventory/proveedores', InventoryController.createProveedor);

describe('Inventory Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /inventory/products', () => {
    test('should create product with valid data', async () => {
      const productData = {
        codigo: 'TEST001',
        nombre: 'Test Product',
        descripcion: 'Test Description',
        categoria: 'Test Category',
        unidad: 'pcs',
        stock_minimo: 10,
        precio: 99.99,
        stock: 50
      };

      query.mockResolvedValueOnce({ rows: [] }); // Check código único
      inventoryService.createProduct.mockResolvedValue({
        id: 1,
        ...productData
      });

      const response = await request(app)
        .post('/inventory/products')
        .send(productData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('creado exitosamente');
    });

    test('should reject product with duplicate code', async () => {
      const productData = {
        codigo: 'EXIST001',
        nombre: 'Test Product',
        categoria: 'Test Category',
        unidad: 'pcs',
        stock_minimo: 10
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Código ya existe

      const response = await request(app)
        .post('/inventory/products')
        .send(productData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    test('should validate required fields', async () => {
      const productData = {
        // Faltan campos requeridos
        codigo: 'TEST001'
      };

      const response = await request(app)
        .post('/inventory/products')
        .send(productData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /inventory/entries', () => {
    test('should register entry with valid data', async () => {
      const entryData = {
        id_producto: 1,
        cantidad: 10,
        referencia: 'ENT001',
        responsable: 'Test User',
        id_proveedor: 1
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, activo: true }] }) // Producto existe
             .mockResolvedValueOnce({ rows: [{ id_proveedor: 1 }] }); // Proveedor existe

      inventoryService.registerMovement.mockResolvedValue({
        id: 1,
        ...entryData
      });

      const response = await request(app)
        .post('/inventory/entries')
        .send(entryData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject entry for inactive product', async () => {
      const entryData = {
        id_producto: 1,
        cantidad: 10,
        referencia: 'ENT001',
        responsable: 'Test User',
        id_proveedor: 1
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, activo: false }] });

      const response = await request(app)
        .post('/inventory/entries')
        .send(entryData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /inventory/exits', () => {
    test('should register exit with sufficient stock', async () => {
      const exitData = {
        id_producto: 1,
        cantidad: 5,
        referencia: 'SAL001',
        responsable: 'Test User',
        id_usuario: 1
      };

      query.mockResolvedValueOnce({ 
        rows: [{ id: 1, activo: true, stock: 10, stock_minimo: 2, nombre: 'Test Product' }] 
      }).mockResolvedValueOnce({ 
        rows: [{ id: 1 }] 
      }); // Usuario existe

      inventoryService.registerMovement.mockResolvedValue({
        id: 1,
        ...exitData
      });

      const response = await request(app)
        .post('/inventory/exits')
        .send(exitData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject exit with insufficient stock', async () => {
      const exitData = {
        id_producto: 1,
        cantidad: 15,
        referencia: 'SAL001',
        responsable: 'Test User',
        id_usuario: 1
      };

      query.mockResolvedValueOnce({ 
        rows: [{ id: 1, activo: true, stock: 10, nombre: 'Test Product' }] 
      });

      const response = await request(app)
        .post('/inventory/exits')
        .send(exitData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Stock insuficiente');
    });
  });

  describe('PUT /inventory/products/:id', () => {
    test('should update product with valid data', async () => {
      const productId = 1;
      const updateData = {
        nombre: 'Updated Product',
        categoria: 'Updated Category',
        unidad: 'pcs',
        stock_minimo: 15,
        precio: 129.99
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Producto existe
             .mockResolvedValueOnce({ rows: [] }); // Código único (si se proporciona)

      inventoryService.updateProduct.mockResolvedValue({
        id: productId,
        ...updateData
      });

      const response = await request(app)
        .put(`/inventory/products/${productId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject update for non-existent product', async () => {
      const productId = 999;
      const updateData = {
        nombre: 'Updated Product'
      };

      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put(`/inventory/products/${productId}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});