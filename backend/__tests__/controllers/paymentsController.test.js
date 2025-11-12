const request = require('supertest');
const express = require('express');
const paymentsController = require('../../controllers/paymentsController');
const { query } = require('../../config/database');
const fetch = require('node-fetch');

// Mock de dependencias
jest.mock('../../config/database');
jest.mock('node-fetch');

const app = express();
app.use(express.json());

// Middleware de autenticación simulado
app.use((req, res, next) => {
  req.user = { userId: 1 };
  next();
});

app.get('/payments/products', paymentsController.getProducts);
app.post('/payments/create-order', paymentsController.createPayPalOrder);
app.post('/payments/verify-order', paymentsController.verifyPayPalOrder);
app.post('/payments/capture-order/:orderId', paymentsController.capturePayPalOrderManual);
app.get('/payments/pending-orders', paymentsController.getAllPendingOrders);
app.post('/payments/approve-order/:orderId', paymentsController.approveOrderManual);
app.post('/payments/callback', paymentsController.handlePayPalCallback);
app.get('/payments/user-orders', paymentsController.getUserOrders);
app.get('/payments/order/:orderId', paymentsController.getOrderDetails);

describe('Payments Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /payments/products', () => {
    test('should return active products', async () => {
      const mockProducts = [
        { id: 1, nombre: 'Product 1', precio: 99.99, stock: 10 },
        { id: 2, nombre: 'Product 2', precio: 149.99, stock: 5 }
      ];

      query.mockResolvedValue({
        rows: mockProducts
      });

      const response = await request(app)
        .get('/payments/products');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /payments/create-order', () => {
    test('should create PayPal order with valid items', async () => {
      const orderData = {
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 }
        ]
      };

      // Mock de productos
      query.mockResolvedValueOnce({ 
        rows: [{ id: 1, nombre: 'Product 1', precio: 50, stock: 10 }] 
      }).mockResolvedValueOnce({ 
        rows: [{ id: 2, nombre: 'Product 2', precio: 30, stock: 5 }] 
      }).mockResolvedValueOnce({ 
        rows: [{ id: 1, total: 130, estado: 'pending' }] 
      }).mockResolvedValueOnce({ 
        rows: [] 
      });

      // Mock de PayPal
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock-token'
        })
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'PAYPAL-ORDER-123',
          status: 'CREATED',
          links: [
            { rel: 'approve', href: 'https://paypal.com/checkout' }
          ]
        })
      });

      const response = await request(app)
        .post('/payments/create-order')
        .send(orderData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paypalOrderId).toBe('PAYPAL-ORDER-123');
    });

    test('should reject order with insufficient stock', async () => {
      const orderData = {
        items: [
          { productId: 1, quantity: 100 } // Stock insuficiente
        ]
      };

      query.mockResolvedValue({
        rows: [{ id: 1, nombre: 'Product 1', precio: 50, stock: 10 }]
      });

      const response = await request(app)
        .post('/payments/create-order')
        .send(orderData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /payments/approve-order/:orderId', () => {
    test('should approve order manually and update stock', async () => {
      const orderId = 1;
      const approveData = {
        notes: 'Approved manually for testing'
      };

      const mockOrder = {
        id: orderId,
        user_id: 1,
        total: 130,
        estado: 'pending',
        items: JSON.stringify([
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 }
        ])
      };

      query.mockResolvedValueOnce({
        rows: [mockOrder]
      }).mockResolvedValueOnce({
        rows: [] // Para las actualizaciones
      });

      const response = await request(app)
        .post(`/payments/approve-order/${orderId}`)
        .send(approveData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('aprobada manualmente');
    });

    test('should reject approval for non-existent order', async () => {
      const orderId = 999;

      query.mockResolvedValue({
        rows: []
      });

      const response = await request(app)
        .post(`/payments/approve-order/${orderId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /payments/user-orders', () => {
    test('should return user orders with pagination', async () => {
      const mockOrders = [
        { id: 1, total: 99.99, estado: 'completed' },
        { id: 2, total: 149.99, estado: 'pending' }
      ];

      query.mockResolvedValueOnce({
        rows: mockOrders
      }).mockResolvedValueOnce({
        rows: [{ count: '2' }]
      });

      const response = await request(app)
        .get('/payments/user-orders')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    test('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/payments/user-orders')
        .query({ page: 'invalid', limit: 10 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});