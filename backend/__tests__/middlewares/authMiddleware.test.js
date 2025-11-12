const authMiddleware = require('../../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');

// Mock de JWT
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let req, res, next;
  const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

  beforeEach(() => {
    req = {
      path: '/api/test',
      headers: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
    
    // Limpiar mocks
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('Rutas públicas', () => {
    const publicRoutes = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/pagos/productos',
      '/api/auth/google',
      '/api/auth/google/callback',
      '/api/biometric/request-pin-reset',
      '/api/biometric/verify-reset-code',
      '/api/biometric/check-reset-status',
      '/api/biometric/verify-code-only',
      '/api/biometric/reset-pin-final',
      '/api/auth/admin-reset-password'
    ];

    publicRoutes.forEach(route => {
      it(`should skip authentication for ${route}`, () => {
        req.path = route;

        authMiddleware(req, res, next);

        expect(console.log).toHaveBeenCalledWith('✅ Ruta pública, skipping auth');
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    it('should log middleware start for public routes', () => {
      req.path = '/api/auth/login';

      authMiddleware(req, res, next);

      expect(console.log).toHaveBeenCalledWith('🔐 === AUTH MIDDLEWARE START ===');
      expect(console.log).toHaveBeenCalledWith('📝 Path:', '/api/auth/login');
    });
  });

  describe('Validación de token', () => {
    it('should return 401 if no authorization header', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = undefined;

      authMiddleware(req, res, next);

      expect(console.log).toHaveBeenCalledWith('❌ No token provided');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token no proporcionado'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header does not start with Bearer', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Basic abc123';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token no proporcionado'
      });
    });

    it('should return 401 for empty Bearer token', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer ';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should log header presence correctly', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 1,
        email: 'test@test.com',
        rol: 'admin'
      });

      authMiddleware(req, res, next);

      expect(console.log).toHaveBeenCalledWith('🔍 Headers authorization:', 'Present');
    });

    it('should log missing header', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = undefined;

      authMiddleware(req, res, next);

      expect(console.log).toHaveBeenCalledWith('🔍 Headers authorization:', 'Missing');
    });
  });

  describe('Verificación exitosa de token', () => {
    it('should verify token and set req.user correctly', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer validtoken123';

      const decodedToken = {
        userId: 1,
        email: 'test@test.com',
        rol: 'admin',
        nombre: 'Test User'
      };

      jwt.verify.mockReturnValue(decodedToken);

      authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken123', JWT_SECRET);
      expect(console.log).toHaveBeenCalledWith('🔑 Verifying token...');
      expect(req.user).toEqual({
        userId: 1,
        email: 'test@test.com',
        rol: 'admin',
        nombre: 'Test User'
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should convert string userId to integer', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: '123',
        email: 'test@test.com',
        rol: 'lector'
      });

      authMiddleware(req, res, next);

      expect(req.user.userId).toBe(123);
      expect(typeof req.user.userId).toBe('number');
    });

    it('should handle token without nombre field', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 1,
        email: 'test@test.com',
        rol: 'editor'
      });

      authMiddleware(req, res, next);

      expect(req.user).toEqual({
        userId: 1,
        email: 'test@test.com',
        rol: 'editor',
        nombre: undefined
      });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Manejo de errores de JWT', () => {
    it('should return 401 for expired token', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer expiredtoken';

      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authMiddleware(req, res, next);

      expect(console.error).toHaveBeenCalledWith('❌ Error verifying token:', 'Token expired');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expirado'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer invalidtoken';

      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token inválido'
      });
    });

    it('should return 401 for generic JWT error', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer token123';

      const error = new Error('Some JWT error');
      error.name = 'SomeOtherError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error de autenticación'
      });
    });
  });

  describe('Diferentes roles de usuario', () => {
    const roles = ['admin', 'editor', 'lector'];

    roles.forEach(rol => {
      it(`should authenticate user with ${rol} role`, () => {
        req.path = '/api/usuarios';
        req.headers.authorization = 'Bearer token123';

        jwt.verify.mockReturnValue({
          userId: 1,
          email: 'test@test.com',
          rol: rol
        });

        authMiddleware(req, res, next);

        expect(req.user.rol).toBe(rol);
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('Casos extremos', () => {
    it('should handle userId as 0', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 0,
        email: 'test@test.com',
        rol: 'admin'
      });

      authMiddleware(req, res, next);

      expect(req.user.userId).toBe(0);
      expect(next).toHaveBeenCalled();
    });

    it('should handle mixed case Bearer', () => {
      req.path = '/api/usuarios';
      req.headers.authorization = 'bearer token123';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});