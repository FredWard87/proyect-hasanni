const request = require('supertest');
const express = require('express');

// Mock de passport y otras dependencias ANTES de importar las rutas
jest.mock('passport', () => ({
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
  authenticate: jest.fn().mockReturnValue((req, res, next) => next())
}));

jest.mock('../../controllers/auth.controller', () => ({
  register: jest.fn((req, res) => res.status(201).json({ success: true, message: 'Usuario registrado' })),
  login: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Login exitoso' })),
  verifyToken: jest.fn((req, res) => res.status(200).json({ success: true, user: {} })),
  logout: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Logout exitoso' })),
  googleCallback: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Google auth success' })),
  getProfile: jest.fn((req, res) => res.status(200).json({ success: true, user: {} })),
  updateProfile: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Perfil actualizado' })),
  requestPasswordReset: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Reset email sent' })),
  resetPassword: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Password reset' }))
}));

// Ahora importamos las rutas después de mockear
const authRoutes = require('../../routes/authRoutes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    test('should register user successfully', async () => {
      const userData = {
        nombre: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('registrado');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('exitoso');
    });
  });

  describe('GET /api/auth/verify-token', () => {
    test('should verify token successfully', async () => {
      const response = await request(app)
        .get('/api/auth/verify-token')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});