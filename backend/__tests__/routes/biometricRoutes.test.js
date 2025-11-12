const request = require('supertest');
const express = require('express');
const biometricRoutes = require('../../routes/biometricRoutes');
const BiometricController = require('../../controllers/biometricController');
const authMiddleware = require('../../middlewares/authMiddleware');

// Mocks
jest.mock('../../controllers/biometricController');
jest.mock('../../middlewares/authMiddleware');

describe('Biometric Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/biometric', biometricRoutes);

    jest.clearAllMocks();

    // Mock del middleware de autenticación
    authMiddleware.mockImplementation((req, res, next) => {
      req.user = { userId: 1, email: 'test@test.com', rol: 'lector' };
      next();
    });
  });

  describe('Public Routes', () => {
    describe('POST /biometric/request-pin-reset', () => {
      it('should request PIN reset successfully', async () => {
        BiometricController.requestPINReset.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            message: 'Código de restablecimiento enviado'
          });
        });

        const response = await request(app)
          .post('/biometric/request-pin-reset')
          .send({ email: 'test@test.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(BiometricController.requestPINReset).toHaveBeenCalled();
      });

      it('should handle user not found', async () => {
        BiometricController.requestPINReset.mockImplementation((req, res) => {
          res.status(404).json({
            success: false,
            message: 'Usuario no encontrado'
          });
        });

        const response = await request(app)
          .post('/biometric/request-pin-reset')
          .send({ email: 'notfound@test.com' });

        expect(response.status).toBe(404);
      });

      it('should not require authentication', async () => {
        BiometricController.requestPINReset.mockImplementation((req, res) => {
          res.status(200).json({ success: true });
        });

        const response = await request(app)
          .post('/biometric/request-pin-reset')
          .send({ email: 'test@test.com' });

        expect(response.status).toBe(200);
        expect(authMiddleware).not.toHaveBeenCalled();
      });
    });

    describe('POST /biometric/verify-code-only', () => {
      it('should verify code successfully', async () => {
        BiometricController.verifyCodeOnly.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            message: 'Código verificado'
          });
        });

        const response = await request(app)
          .post('/biometric/verify-code-only')
          .send({
            email: 'test@test.com',
            code: '123456'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(BiometricController.verifyCodeOnly).toHaveBeenCalled();
      });

      it('should reject invalid code', async () => {
        BiometricController.verifyCodeOnly.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            message: 'Código inválido'
          });
        });

        const response = await request(app)
          .post('/biometric/verify-code-only')
          .send({
            email: 'test@test.com',
            code: 'wrong'
          });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /biometric/reset-pin-final', () => {
      it('should reset PIN with code successfully', async () => {
        BiometricController.resetPINWithCode.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            message: 'PIN restablecido exitosamente'
          });
        });

        const response = await request(app)
          .post('/biometric/reset-pin-final')
          .send({
            email: 'test@test.com',
            code: '123456',
            newPIN: '5678'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(BiometricController.resetPINWithCode).toHaveBeenCalled();
      });

      it('should validate PIN format', async () => {
        BiometricController.resetPINWithCode.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            message: 'PIN inválido'
          });
        });

        const response = await request(app)
          .post('/biometric/reset-pin-final')
          .send({
            email: 'test@test.com',
            code: '123456',
            newPIN: '1234' // Common PIN
          });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /biometric/check-reset-status', () => {
      it('should check reset status successfully', async () => {
        BiometricController.checkResetCodeStatus.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            valid: true,
            expiresIn: 300
          });
        });

        const response = await request(app)
          .post('/biometric/check-reset-status')
          .send({
            email: 'test@test.com',
            code: '123456'
          });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
        expect(BiometricController.checkResetCodeStatus).toHaveBeenCalled();
      });

      it('should handle expired code', async () => {
        BiometricController.checkResetCodeStatus.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            valid: false,
            message: 'Código expirado'
          });
        });

        const response = await request(app)
          .post('/biometric/check-reset-status')
          .send({
            email: 'test@test.com',
            code: '123456'
          });

        expect(response.status).toBe(400);
        expect(response.body.valid).toBe(false);
      });
    });
  });

  describe('Protected Routes', () => {
    describe('POST /biometric/setup-pin', () => {
      it('should setup PIN successfully', async () => {
        BiometricController.setupPIN.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            message: 'PIN configurado exitosamente'
          });
        });

        const response = await request(app)
          .post('/biometric/setup-pin')
          .set('Authorization', 'Bearer token123')
          .send({ pin: '5678' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(authMiddleware).toHaveBeenCalled();
        expect(BiometricController.setupPIN).toHaveBeenCalled();
      });

      it('should require authentication', async () => {
        authMiddleware.mockImplementation((req, res, next) => {
          res.status(401).json({
            success: false,
            message: 'No autorizado'
          });
        });

        const response = await request(app)
          .post('/biometric/setup-pin')
          .send({ pin: '5678' });

        expect(response.status).toBe(401);
      });

      it('should reject common PIN', async () => {
        BiometricController.setupPIN.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            message: 'PIN demasiado común'
          });
        });

        const response = await request(app)
          .post('/biometric/setup-pin')
          .set('Authorization', 'Bearer token123')
          .send({ pin: '1234' });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /biometric/verify-pin', () => {
      it('should verify PIN successfully', async () => {
        BiometricController.verifyPIN.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            message: 'PIN verificado',
            biometricToken: 'bio_token'
          });
        });

        const response = await request(app)
          .post('/biometric/verify-pin')
          .set('Authorization', 'Bearer token123')
          .send({ pin: '5678' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('biometricToken');
        expect(BiometricController.verifyPIN).toHaveBeenCalled();
      });

      it('should reject incorrect PIN', async () => {
        BiometricController.verifyPIN.mockImplementation((req, res) => {
          res.status(401).json({
            success: false,
            message: 'PIN incorrecto',
            attemptsRemaining: 4
          });
        });

        const response = await request(app)
          .post('/biometric/verify-pin')
          .set('Authorization', 'Bearer token123')
          .send({ pin: '0000' });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should handle locked account', async () => {
        BiometricController.verifyPIN.mockImplementation((req, res) => {
          res.status(423).json({
            success: false,
            message: 'Cuenta bloqueada temporalmente',
            lockedUntil: new Date(Date.now() + 900000)
          });
        });

        const response = await request(app)
          .post('/biometric/verify-pin')
          .set('Authorization', 'Bearer token123')
          .send({ pin: '5678' });

        expect(response.status).toBe(423);
        expect(response.body).toHaveProperty('lockedUntil');
      });
    });

    describe('GET /biometric/status', () => {
      it('should get PIN status successfully', async () => {
        BiometricController.getPINStatus.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            biometricEnabled: true,
            pinConfigured: true,
            failedAttempts: 0
          });
        });

        const response = await request(app)
          .get('/biometric/status')
          .set('Authorization', 'Bearer token123');

        expect(response.status).toBe(200);
        expect(response.body.biometricEnabled).toBe(true);
        expect(BiometricController.getPINStatus).toHaveBeenCalled();
      });

      it('should handle user without biometric', async () => {
        BiometricController.getPINStatus.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            biometricEnabled: false,
            pinConfigured: false
          });
        });

        const response = await request(app)
          .get('/biometric/status')
          .set('Authorization', 'Bearer token123');

        expect(response.status).toBe(200);
        expect(response.body.biometricEnabled).toBe(false);
      });
    });

    describe('POST /biometric/disable', () => {
      it('should disable biometric successfully', async () => {
        BiometricController.disableBiometric.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            message: 'Autenticación biométrica deshabilitada'
          });
        });

        const response = await request(app)
          .post('/biometric/disable')
          .set('Authorization', 'Bearer token123');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(BiometricController.disableBiometric).toHaveBeenCalled();
      });

      it('should handle already disabled biometric', async () => {
        BiometricController.disableBiometric.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            message: 'Biométrico ya está deshabilitado'
          });
        });

        const response = await request(app)
          .post('/biometric/disable')
          .set('Authorization', 'Bearer token123');

        expect(response.status).toBe(400);
      });
    });

    describe('POST /biometric/change-pin', () => {
      it('should change PIN successfully', async () => {
        BiometricController.changePIN.mockImplementation((req, res) => {
          res.status(200).json({
            success: true,
            message: 'PIN cambiado exitosamente'
          });
        });

        const response = await request(app)
          .post('/biometric/change-pin')
          .set('Authorization', 'Bearer token123')
          .send({
            currentPIN: '5678',
            newPIN: '9012'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(BiometricController.changePIN).toHaveBeenCalled();
      });

      it('should reject incorrect current PIN', async () => {
        BiometricController.changePIN.mockImplementation((req, res) => {
          res.status(401).json({
            success: false,
            message: 'PIN actual incorrecto'
          });
        });

        const response = await request(app)
          .post('/biometric/change-pin')
          .set('Authorization', 'Bearer token123')
          .send({
            currentPIN: 'wrong',
            newPIN: '9012'
          });

        expect(response.status).toBe(401);
      });

      it('should validate new PIN format', async () => {
        BiometricController.changePIN.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            message: 'Nuevo PIN inválido'
          });
        });

        const response = await request(app)
          .post('/biometric/change-pin')
          .set('Authorization', 'Bearer token123')
          .send({
            currentPIN: '5678',
            newPIN: 'abcd'
          });

        expect(response.status).toBe(400);
      });

      it('should reject same PIN', async () => {
        BiometricController.changePIN.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            message: 'El nuevo PIN debe ser diferente al actual'
          });
        });

        const response = await request(app)
          .post('/biometric/change-pin')
          .set('Authorization', 'Bearer token123')
          .send({
            currentPIN: '5678',
            newPIN: '5678'
          });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Route Protection', () => {
    it('should allow public routes without authentication', async () => {
      BiometricController.requestPINReset.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/biometric/request-pin-reset')
        .send({ email: 'test@test.com' });

      expect(response.status).toBe(200);
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should protect authenticated routes', async () => {
      authMiddleware.mockImplementation((req, res, next) => {
        if (!req.headers.authorization) {
          return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        next();
      });

      const protectedRoutes = [
        { method: 'post', path: '/biometric/setup-pin', body: { pin: '5678' } },
        { method: 'post', path: '/biometric/verify-pin', body: { pin: '5678' } },
        { method: 'get', path: '/biometric/status' },
        { method: 'post', path: '/biometric/disable' },
        { method: 'post', path: '/biometric/change-pin', body: { currentPIN: '5678', newPIN: '9012' } }
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)[route.method](route.path)
          .send(route.body || {});
        
        expect([401, 404]).toContain(response.status);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      BiometricController.setupPIN.mockImplementation((req, res) => {
        throw new Error('Unexpected error');
      });

      await expect(
        request(app)
          .post('/biometric/setup-pin')
          .set('Authorization', 'Bearer token123')
          .send({ pin: '5678' })
      ).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      BiometricController.setupPIN.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'PIN es requerido'
        });
      });

      const response = await request(app)
        .post('/biometric/setup-pin')
        .set('Authorization', 'Bearer token123')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting Scenarios', () => {
    it('should handle too many failed attempts', async () => {
      BiometricController.verifyPIN.mockImplementation((req, res) => {
        res.status(429).json({
          success: false,
          message: 'Demasiados intentos fallidos',
          retryAfter: 900
        });
      });

      const response = await request(app)
        .post('/biometric/verify-pin')
        .set('Authorization', 'Bearer token123')
        .send({ pin: '0000' });

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('retryAfter');
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete full PIN setup flow', async () => {
      // Step 1: Setup PIN
      BiometricController.setupPIN.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'PIN configurado' });
      });

      const setupResponse = await request(app)
        .post('/biometric/setup-pin')
        .set('Authorization', 'Bearer token123')
        .send({ pin: '5678' });

      expect(setupResponse.status).toBe(200);

      // Step 2: Verify PIN
      BiometricController.verifyPIN.mockImplementation((req, res) => {
        res.status(200).json({ success: true, biometricToken: 'bio_token' });
      });

      const verifyResponse = await request(app)
        .post('/biometric/verify-pin')
        .set('Authorization', 'Bearer token123')
        .send({ pin: '5678' });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toHaveProperty('biometricToken');
    });

    it('should complete full PIN reset flow', async () => {
      // Step 1: Request reset
      BiometricController.requestPINReset.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'Código enviado' });
      });

      const requestResponse = await request(app)
        .post('/biometric/request-pin-reset')
        .send({ email: 'test@test.com' });

      expect(requestResponse.status).toBe(200);

      // Step 2: Verify code
      BiometricController.verifyCodeOnly.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'Código verificado' });
      });

      const verifyResponse = await request(app)
        .post('/biometric/verify-code-only')
        .send({ email: 'test@test.com', code: '123456' });

      expect(verifyResponse.status).toBe(200);

      // Step 3: Reset PIN
      BiometricController.resetPINWithCode.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'PIN restablecido' });
      });

      const resetResponse = await request(app)
        .post('/biometric/reset-pin-final')
        .send({ email: 'test@test.com', code: '123456', newPIN: '9012' });

      expect(resetResponse.status).toBe(200);
    });
  });
});