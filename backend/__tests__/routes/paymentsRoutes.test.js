const request = require('supertest');
const express = require('express');
const paymentsRoutes = require('../../routes/paymentsRoutes');
const paymentsController = require('../../controllers/paymentsController');
const adminMiddleware = require('../../middlewares/adminMiddleware');

// Mock de los controladores y middlewares
jest.mock('../../controllers/paymentsController');
jest.mock('../../middlewares/adminMiddleware', () => 
  jest.fn((req, res, next) => next())
);

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRoutes);

describe('Payments Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/payments/productos', () => {
    test('should get products successfully', async () => {
      const mockProducts = [
        { id: 1, nombre: 'Producto A', precio: 100 },
        { id: 2, nombre: 'Producto B', precio: 200 }
      ];

      paymentsController.getProducts.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockProducts
        });
      });

      const response = await request(app)
        .get('/api/payments/productos')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(paymentsController.getProducts).toHaveBeenCalledTimes(1);
    });

    test('should handle server errors in getProducts', async () => {
      paymentsController.getProducts.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Error del servidor'
        });
      });

      const response = await request(app)
        .get('/api/payments/productos')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Error');
    });
  });

  describe('POST /api/payments/crear-orden', () => {
    test('should create PayPal order successfully', async () => {
      const mockOrder = {
        id: 'ORDER123',
        status: 'CREATED',
        links: [{ rel: 'approve', href: 'https://paypal.com/checkout' }]
      };

      paymentsController.createPayPalOrder.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: mockOrder
        });
      });

      const orderData = {
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 }
        ],
        total: 400
      };

      const response = await request(app)
        .post('/api/payments/crear-orden')
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('ORDER123');
      expect(paymentsController.createPayPalOrder).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/payments/callback-paypal', () => {
    test('should handle PayPal callback successfully', async () => {
      paymentsController.handlePayPalCallback.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Callback procesado correctamente'
        });
      });

      const callbackData = {
        orderID: 'ORDER123',
        payerID: 'PAYER123'
      };

      const response = await request(app)
        .post('/api/payments/callback-paypal')
        .send(callbackData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('procesado');
    });
  });

  describe('GET /api/payments/ordenes', () => {
    test('should get user orders successfully', async () => {
      const mockOrders = [
        { id: 1, total: 100, status: 'COMPLETED' },
        { id: 2, total: 200, status: 'PENDING' }
      ];

      paymentsController.getUserOrders.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockOrders,
          total: mockOrders.length
        });
      });

      const response = await request(app)
        .get('/api/payments/ordenes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });
  });

  describe('GET /api/payments/ordenes/:orderId', () => {
    test('should get order details successfully', async () => {
      const mockOrder = {
        id: 1,
        total: 150,
        status: 'COMPLETED',
        items: [{ productId: 1, quantity: 1 }]
      };

      paymentsController.getOrderDetails.mockImplementation((req, res) => {
        expect(req.params.orderId).toBe('1');
        res.status(200).json({
          success: true,
          data: mockOrder
        });
      });

      const response = await request(app)
        .get('/api/payments/ordenes/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.total).toBe(150);
    });

    test('should handle order not found', async () => {
      paymentsController.getOrderDetails.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Orden no encontrada'
        });
      });

      const response = await request(app)
        .get('/api/payments/ordenes/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('no encontrada');
    });
  });

  // Rutas de administración
  describe('Admin Routes', () => {
    test('GET /api/payments/admin/ordenes-pendientes should call admin middleware', async () => {
      paymentsController.getAllPendingOrders.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: []
        });
      });

      await request(app)
        .get('/api/payments/admin/ordenes-pendientes')
        .expect(200);

      expect(adminMiddleware).toHaveBeenCalled();
      expect(paymentsController.getAllPendingOrders).toHaveBeenCalledTimes(1);
    });

    test('POST /api/payments/admin/verificar-orden should verify order', async () => {
      paymentsController.verifyPayPalOrder.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          verified: true
        });
      });

      const response = await request(app)
        .post('/api/payments/admin/verificar-orden')
        .send({ orderId: 'ORDER123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);
    });

    test('POST /api/payments/admin/capturar-orden/:orderId should capture order', async () => {
      paymentsController.capturePayPalOrderManual.mockImplementation((req, res) => {
        expect(req.params.orderId).toBe('ORDER123');
        res.status(200).json({
          success: true,
          captured: true
        });
      });

      const response = await request(app)
        .post('/api/payments/admin/capturar-orden/ORDER123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.captured).toBe(true);
    });

    test('POST /api/payments/admin/aprobar-manual/:orderId should approve manually', async () => {
      paymentsController.approveOrderManual.mockImplementation((req, res) => {
        expect(req.params.orderId).toBe('ORDER456');
        res.status(200).json({
          success: true,
          approved: true
        });
      });

      const response = await request(app)
        .post('/api/payments/admin/aprobar-manual/ORDER456')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.approved).toBe(true);
    });
  });

  // Tests para verificar que todas las rutas están definidas
  describe('Route Existence', () => {
    test('should have all payment routes defined', () => {
      const routes = [
        { method: 'GET', path: '/productos' },
        { method: 'POST', path: '/crear-orden' },
        { method: 'POST', path: '/callback-paypal' },
        { method: 'GET', path: '/ordenes' },
        { method: 'GET', path: '/ordenes/:orderId' },
        { method: 'GET', path: '/admin/ordenes-pendientes' },
        { method: 'POST', path: '/admin/verificar-orden' },
        { method: 'POST', path: '/admin/capturar-orden/:orderId' },
        { method: 'POST', path: '/admin/aprobar-manual/:orderId' }
      ];

      routes.forEach(expectedRoute => {
        const routeExists = paymentsRoutes.stack.some(layer => {
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
});