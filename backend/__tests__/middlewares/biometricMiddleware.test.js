const { verifyBiometric, checkBiometricSetup } = require('../../middlewares/biometricMiddleware');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');

// Mocks
jest.mock('jsonwebtoken');
jest.mock('../../config/database');

describe('Biometric Middleware', () => {
  let req, res, next;
  const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
    
    // Limpiar mocks
    jest.clearAllMocks();
    console.error = jest.fn();
    
    // Configurar JWT_SECRET en process.env
    process.env.JWT_SECRET = 'supersecret';
  });

  describe('verifyBiometric - Validación de token', () => {
    it('should return 401 if no authorization header', async () => {
      req.headers['authorization'] = undefined;

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Se requiere autenticación biométrica',
        requiresBiometric: true
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header is empty', async () => {
      req.headers['authorization'] = '';

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Se requiere autenticación biométrica',
        requiresBiometric: true
      });
    });

    it('should return 401 if token is missing after Bearer', async () => {
      req.headers['authorization'] = 'Bearer ';

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should extract token correctly from Bearer header', async () => {
      req.headers['authorization'] = 'Bearer validtoken123';

      jwt.verify.mockReturnValue({
        userId: 1,
        biometric: true,
        type: 'biometric_session'
      });

      query.mockResolvedValue({
        rows: [{ id: 1, biometric_enabled: true }]
      });

      await verifyBiometric(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken123', JWT_SECRET);
    });
  });

  describe('verifyBiometric - Validación de token biométrico', () => {
    it('should return 401 if token is not biometric type', async () => {
      req.headers['authorization'] = 'Bearer normaltoken';

      jwt.verify.mockReturnValue({
        userId: 1,
        biometric: false,
        type: 'normal_session'
      });

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token biométrico inválido',
        requiresBiometric: true
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if biometric flag is missing', async () => {
      req.headers['authorization'] = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 1,
        type: 'biometric_session'
      });

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token biométrico inválido',
        requiresBiometric: true
      });
    });

    it('should return 401 if type is not biometric_session', async () => {
      req.headers['authorization'] = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 1,
        biometric: true,
        type: 'regular'
      });

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('verifyBiometric - Validación de usuario en BD', () => {
    it('should return 401 if user not found in database', async () => {
      req.headers['authorization'] = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 999,
        biometric: true,
        type: 'biometric_session'
      });

      query.mockResolvedValue({
        rows: []
      });

      await verifyBiometric(req, res, next);

      expect(query).toHaveBeenCalledWith(
        'SELECT id, biometric_enabled FROM usuarios WHERE id = $1',
        [999]
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Autenticación biométrica no configurada',
        requiresBiometric: true
      });
    });

    it('should return 401 if biometric is not enabled for user', async () => {
      req.headers['authorization'] = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 1,
        biometric: true,
        type: 'biometric_session'
      });

      query.mockResolvedValue({
        rows: [{ id: 1, biometric_enabled: false }]
      });

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Autenticación biométrica no configurada',
        requiresBiometric: true
      });
    });

    it('should return 401 if biometric_enabled is null', async () => {
      req.headers['authorization'] = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 1,
        biometric: true,
        type: 'biometric_session'
      });

      query.mockResolvedValue({
        rows: [{ id: 1, biometric_enabled: null }]
      });

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('verifyBiometric - Verificación exitosa', () => {
    it('should set req.user and call next on successful verification', async () => {
      req.headers['authorization'] = 'Bearer validtoken';

      jwt.verify.mockReturnValue({
        userId: 1,
        biometric: true,
        type: 'biometric_session'
      });

      query.mockResolvedValue({
        rows: [{ id: 1, biometric_enabled: true }]
      });

      await verifyBiometric(req, res, next);

      expect(req.user).toEqual({
        userId: 1,
        biometricVerified: true
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should work with different userId values', async () => {
      req.headers['authorization'] = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 42,
        biometric: true,
        type: 'biometric_session'
      });

      query.mockResolvedValue({
        rows: [{ id: 42, biometric_enabled: true }]
      });

      await verifyBiometric(req, res, next);

      expect(req.user.userId).toBe(42);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('verifyBiometric - Manejo de errores JWT', () => {
    it('should return 401 with expired flag for expired tokens', async () => {
      req.headers['authorization'] = 'Bearer expiredtoken';

      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await verifyBiometric(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Sesión biométrica expirada',
        requiresBiometric: true,
        expired: true
      });
    });

    it('should handle generic JWT errors', async () => {
      req.headers['authorization'] = 'Bearer badtoken';

      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await verifyBiometric(req, res, next);

      expect(console.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error de autenticación biométrica',
        requiresBiometric: true
      });
    });

    it('should handle database errors', async () => {
      req.headers['authorization'] = 'Bearer token123';

      jwt.verify.mockReturnValue({
        userId: 1,
        biometric: true,
        type: 'biometric_session'
      });

      query.mockRejectedValue(new Error('DB connection failed'));

      await verifyBiometric(req, res, next);

      expect(console.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('checkBiometricSetup - Validación de setup', () => {
    it('should set requiresBiometricSetup to true for new users without biometric', async () => {
      req.user = { userId: 1 };

      query.mockResolvedValue({
        rows: [{
          biometric_enabled: false,
          is_new_user: true
        }]
      });

      await checkBiometricSetup(req, res, next);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT biometric_enabled'),
        [1]
      );
      expect(req.requiresBiometricSetup).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('should set requiresBiometricSetup to false for users with biometric enabled', async () => {
      req.user = { userId: 1 };

      query.mockResolvedValue({
        rows: [{
          biometric_enabled: true,
          is_new_user: true
        }]
      });

      await checkBiometricSetup(req, res, next);

      expect(req.requiresBiometricSetup).toBe(false);
      expect(next).toHaveBeenCalled();
    });

    it('should set requiresBiometricSetup to false for old users without biometric', async () => {
      req.user = { userId: 1 };

      query.mockResolvedValue({
        rows: [{
          biometric_enabled: false,
          is_new_user: false
        }]
      });

      await checkBiometricSetup(req, res, next);

      expect(req.requiresBiometricSetup).toBe(false);
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty database results', async () => {
      req.user = { userId: 999 };

      query.mockResolvedValue({
        rows: []
      });

      await checkBiometricSetup(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      req.user = { userId: 1 };

      query.mockRejectedValue(new Error('DB error'));

      await checkBiometricSetup(req, res, next);

      expect(console.error).toHaveBeenCalledWith('Error verificando setup biométrico:', expect.any(Error));
      expect(req.requiresBiometricSetup).toBe(false);
      expect(next).toHaveBeenCalled();
    });

    it('should not crash if req.user is missing', async () => {
      req.user = null;

      await checkBiometricSetup(req, res, next);

      expect(console.error).toHaveBeenCalled();
      expect(req.requiresBiometricSetup).toBe(false);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('checkBiometricSetup - Casos extremos', () => {
    it('should handle null biometric_enabled', async () => {
      req.user = { userId: 1 };

      query.mockResolvedValue({
        rows: [{
          biometric_enabled: null,
          is_new_user: true
        }]
      });

      await checkBiometricSetup(req, res, next);

      expect(req.requiresBiometricSetup).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('should handle null is_new_user', async () => {
      req.user = { userId: 1 };

      query.mockResolvedValue({
        rows: [{
          biometric_enabled: false,
          is_new_user: null
        }]
      });

      await checkBiometricSetup(req, res, next);

      expect(req.requiresBiometricSetup).toBe(false);
      expect(next).toHaveBeenCalled();
    });
  });
});