const request = require('supertest');
const express = require('express');
const supplierRoutes = require('../../routes/supplierRoutes');
const suppliersController = require('../../controllers/SuppliersController');

// Mock del controlador
jest.mock('../../controllers/SuppliersController');

const app = express();
app.use(express.json());
app.use('/api/suppliers', supplierRoutes);

describe('Supplier Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/suppliers', () => {
    test('should get all suppliers successfully', async () => {
      const mockSuppliers = [
        {
          id: 1,
          nombre: 'Proveedor A',
          contacto: 'contacto@proveedora.com',
          telefono: '+1234567890',
          direccion: 'Calle Principal 123',
          activo: true
        },
        {
          id: 2,
          nombre: 'Proveedor B',
          contacto: 'contacto@proveedorb.com',
          telefono: '+0987654321',
          direccion: 'Avenida Secundaria 456',
          activo: true
        }
      ];

      suppliersController.getSuppliers.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockSuppliers,
          total: mockSuppliers.length
        });
      });

      const response = await request(app)
        .get('/api/suppliers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].nombre).toBe('Proveedor A');
      expect(response.body.data[1].nombre).toBe('Proveedor B');
      expect(response.body.total).toBe(2);
      expect(suppliersController.getSuppliers).toHaveBeenCalledTimes(1);
    });

    test('should handle empty suppliers list', async () => {
      suppliersController.getSuppliers.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [],
          total: 0,
          message: 'No se encontraron proveedores'
        });
      });

      const response = await request(app)
        .get('/api/suppliers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
      expect(response.body.message).toContain('No se encontraron');
    });

    test('should handle server errors in getSuppliers', async () => {
      suppliersController.getSuppliers.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Error del servidor al obtener proveedores'
        });
      });

      const response = await request(app)
        .get('/api/suppliers')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Error del servidor');
    });
  });

  describe('POST /api/suppliers', () => {
    test('should create a new supplier successfully', async () => {
      const newSupplier = {
        nombre: 'Nuevo Proveedor',
        contacto: 'nuevo@proveedor.com',
        telefono: '+1122334455',
        direccion: 'Nueva Dirección 789'
      };

      const createdSupplier = {
        id: 3,
        ...newSupplier,
        activo: true,
        fecha_creacion: '2024-01-01T00:00:00.000Z'
      };

      suppliersController.createSupplier.mockImplementation((req, res) => {
        expect(req.body).toEqual(newSupplier);
        res.status(201).json({
          success: true,
          message: 'Proveedor creado exitosamente',
          data: createdSupplier
        });
      });

      const response = await request(app)
        .post('/api/suppliers')
        .send(newSupplier)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('creado exitosamente');
      expect(response.body.data.id).toBe(3);
      expect(response.body.data.nombre).toBe('Nuevo Proveedor');
      expect(suppliersController.createSupplier).toHaveBeenCalledTimes(1);
    });

    test('should handle validation errors in createSupplier', async () => {
      const invalidSupplier = {
        // Falta el campo nombre requerido
        contacto: 'contacto@test.com',
        telefono: '+1234567890'
      };

      suppliersController.createSupplier.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'El nombre del proveedor es requerido',
          errors: ['nombre es un campo requerido']
        });
      });

      const response = await request(app)
        .post('/api/suppliers')
        .send(invalidSupplier)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('requerido');
      expect(response.body.errors).toBeDefined();
    });

    test('should handle duplicate supplier creation', async () => {
      const duplicateSupplier = {
        nombre: 'Proveedor Existente',
        contacto: 'existente@proveedor.com',
        telefono: '+1234567890'
      };

      suppliersController.createSupplier.mockImplementation((req, res) => {
        res.status(409).json({
          success: false,
          message: 'Ya existe un proveedor con ese nombre'
        });
      });

      const response = await request(app)
        .post('/api/suppliers')
        .send(duplicateSupplier)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Ya existe');
    });
  });

  describe('PUT /api/suppliers/:id', () => {
    test('should update supplier successfully', async () => {
      const supplierId = 1;
      const updateData = {
        nombre: 'Proveedor Actualizado',
        contacto: 'actualizado@proveedor.com',
        telefono: '+9988776655',
        direccion: 'Dirección Actualizada 999'
      };

      const updatedSupplier = {
        id: supplierId,
        ...updateData,
        activo: true
      };

      suppliersController.updateSupplier.mockImplementation((req, res) => {
        expect(req.params.id).toBe(supplierId.toString());
        expect(req.body).toEqual(updateData);
        res.status(200).json({
          success: true,
          message: 'Proveedor actualizado exitosamente',
          data: updatedSupplier
        });
      });

      const response = await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('actualizado exitosamente');
      expect(response.body.data.id).toBe(supplierId);
      expect(response.body.data.nombre).toBe('Proveedor Actualizado');
    });

    test('should handle supplier not found in update', async () => {
      const nonExistentId = 999;
      const updateData = {
        nombre: 'Proveedor Inexistente'
      };

      suppliersController.updateSupplier.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      });

      const response = await request(app)
        .put(`/api/suppliers/${nonExistentId}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('no encontrado');
    });

    test('should handle invalid ID parameter', async () => {
      const invalidId = 'invalid-id';
      const updateData = {
        nombre: 'Proveedor Test'
      };

      suppliersController.updateSupplier.mockImplementation((req, res) => {
        // El controlador podría validar el ID
        expect(req.params.id).toBe(invalidId);
        res.status(400).json({
          success: false,
          message: 'ID de proveedor inválido'
        });
      });

      const response = await request(app)
        .put(`/api/suppliers/${invalidId}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('inválido');
    });

    test('should handle partial updates', async () => {
      const supplierId = 2;
      const partialUpdate = {
        telefono: '+1111111111' // Solo actualizar teléfono
      };

      suppliersController.updateSupplier.mockImplementation((req, res) => {
        expect(req.body).toEqual(partialUpdate);
        res.status(200).json({
          success: true,
          message: 'Proveedor actualizado parcialmente',
          data: {
            id: supplierId,
            nombre: 'Proveedor B',
            telefono: '+1111111111',
            // ... otros campos sin cambios
          }
        });
      });

      const response = await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.telefono).toBe('+1111111111');
    });
  });

  describe('Route Existence', () => {
    test('should have all supplier routes defined', () => {
      const routes = [
        { method: 'GET', path: '/' },
        { method: 'POST', path: '/' },
        { method: 'PUT', path: '/:id' }
      ];

      routes.forEach(expectedRoute => {
        const routeExists = supplierRoutes.stack.some(layer => {
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

  describe('Request Validation', () => {
    test('should accept valid supplier data formats', async () => {
      const validSupplier = {
        nombre: 'Proveedor Válido',
        contacto: 'contacto@valido.com',
        telefono: '+1234567890',
        direccion: 'Dirección Válida 123',
        activo: true
      };

      suppliersController.createSupplier.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: { id: 1, ...validSupplier }
        });
      });

      const response = await request(app)
        .post('/api/suppliers')
        .send(validSupplier)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});