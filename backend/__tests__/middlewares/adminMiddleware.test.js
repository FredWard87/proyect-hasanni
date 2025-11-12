const adminMiddleware = require('../../middlewares/adminMiddleware');
const { query } = require('../../config/database');

// Mock de la base de datos
jest.mock('../../config/database');

describe('Admin Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: null,
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

  describe('Validación de autenticación', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = null;

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Usuario no autenticado'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if userId is missing', async () => {
      req.user = { email: 'test@test.com' };

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Usuario no autenticado'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Validación de usuario en base de datos', () => {
    it('should return 401 if user is not found in database', async () => {
      req.user = { userId: 999 };
      
      query.mockResolvedValue({ rows: [] });

      await adminMiddleware(req, res, next);

      expect(query).toHaveBeenCalledWith(
        'SELECT rol FROM usuarios WHERE id = $1',
        [999]
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Usuario no encontrado'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Validación de rol de administrador', () => {
    it('should return 403 if user is not admin', async () => {
      req.user = { userId: 1 };
      
      query.mockResolvedValue({
        rows: [{ rol: 'lector' }]
      });

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user has editor role', async () => {
      req.user = { userId: 2 };
      
      query.mockResolvedValue({
        rows: [{ rol: 'editor' }]
      });

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user is admin', async () => {
      req.user = { userId: 1 };
      
      query.mockResolvedValue({
        rows: [{ rol: 'admin' }]
      });

      await adminMiddleware(req, res, next);

      expect(console.log).toHaveBeenCalledWith('✅ Usuario admin autorizado:', 1);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('Manejo de errores', () => {
    it('should return 500 if database query fails', async () => {
      req.user = { userId: 1 };
      
      const dbError = new Error('Database connection failed');
      query.mockRejectedValue(dbError);

      await adminMiddleware(req, res, next);

      expect(console.error).toHaveBeenCalledWith('Error en middleware de admin:', dbError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error interno del servidor'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors gracefully', async () => {
      req.user = { userId: 1 };
      
      query.mockRejectedValue(new Error('Unexpected error'));

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error interno del servidor'
      });
    });
  });

  describe('Casos extremos', () => {
    it('should handle userId as string', async () => {
      req.user = { userId: '1' };
      
      query.mockResolvedValue({
        rows: [{ rol: 'admin' }]
      });

      await adminMiddleware(req, res, next);

      expect(query).toHaveBeenCalledWith(
        'SELECT rol FROM usuarios WHERE id = $1',
        ['1']
      );
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty rol value', async () => {
      req.user = { userId: 1 };
      
      query.mockResolvedValue({
        rows: [{ rol: '' }]
      });

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle null rol value', async () => {
      req.user = { userId: 1 };
      
      query.mockResolvedValue({
        rows: [{ rol: null }]
      });

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle undefined rol value', async () => {
      req.user = { userId: 1 };
      
      query.mockResolvedValue({
        rows: [{}]
      });

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Integración con flujo de autenticación', () => {
    it('should work correctly after authMiddleware', async () => {
      req.user = {
        userId: 1,
        email: 'admin@test.com',
        rol: 'admin'
      };
      
      query.mockResolvedValue({
        rows: [{ rol: 'admin' }]
      });

      await adminMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should validate even if req.user has rol property', async () => {
      req.user = {
        userId: 1,
        email: 'fake@test.com',
        rol: 'admin'
      };
      
      query.mockResolvedValue({
        rows: [{ rol: 'lector' }]
      });

      await adminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Logging y debugging', () => {
    it('should log successful admin authorization', async () => {
      req.user = { userId: 1 };
      
      query.mockResolvedValue({
        rows: [{ rol: 'admin' }]
      });

      await adminMiddleware(req, res, next);

      expect(console.log).toHaveBeenCalledWith('✅ Usuario admin autorizado:', 1);
    });

    it('should log error details on failure', async () => {
      req.user = { userId: 1 };
      
      const error = new Error('Database error');
      query.mockRejectedValue(error);

      await adminMiddleware(req, res, next);

      expect(console.error).toHaveBeenCalledWith('Error en middleware de admin:', error);
    });
  });
});