const request = require('supertest');
const express = require('express');
const UsuarioRoutes = require('../../routes/UsuarioRoutes');
const UsuarioController = require('../../controllers/UsuarioController');
const authMiddleware = require('../../middlewares/authMiddleware');

// Mock de dependencias
jest.mock('../../controllers/UsuarioController');
jest.mock('../../middlewares/authMiddleware');

// Mock del middleware de autenticación
authMiddleware.mockImplementation((req, res, next) => {
  req.user = { userId: 1, rol: 'admin' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api', UsuarioRoutes);

describe('Usuario Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    test('should return health check successfully', async () => {
      const mockHealthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      };

      UsuarioController.healthCheck.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'API is healthy',
          data: mockHealthData
        });
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('healthy');
      expect(response.body.data).toHaveProperty('status', 'OK');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(UsuarioController.healthCheck).toHaveBeenCalledTimes(1);
    });

    test('should apply auth middleware to all routes', async () => {
      // Verificar que el middleware se aplica
      expect(authMiddleware).toHaveBeenCalled();

      // Mock para la ruta de health
      UsuarioController.healthCheck.mockImplementation((req, res) => {
        // Verificar que el usuario está en el request (del middleware)
        expect(req.user).toBeDefined();
        expect(req.user.userId).toBe(1);
        expect(req.user.rol).toBe('admin');
        
        res.status(200).json({
          success: true,
          message: 'Health check with auth'
        });
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle health check errors', async () => {
      UsuarioController.healthCheck.mockImplementation((req, res) => {
        res.status(503).json({
          success: false,
          message: 'Service unavailable',
          error: 'Database connection failed'
        });
      });

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('unavailable');
    });
  });

  describe('Route Configuration', () => {
    test('should have all usuario routes defined with correct methods', () => {
      const expectedRoutes = [
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/usuarios' },
        { method: 'GET', path: '/usuarios/roles' },
        { method: 'GET', path: '/usuarios/estadisticas' },
        { method: 'GET', path: '/usuarios/:id' },
        { method: 'POST', path: '/usuarios' },
        { method: 'PUT', path: '/usuarios/:id' },
        { method: 'DELETE', path: '/usuarios/:id' }
      ];

      // Verificar que cada ruta existe en el router
      expectedRoutes.forEach(expectedRoute => {
        const routeExists = UsuarioRoutes.stack.some(layer => {
          if (layer.route) {
            const path = layer.route.path;
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
            return path === expectedRoute.path && methods.includes(expectedRoute.method);
          }
          return false;
        });

        expect(routeExists).toBe(true);
      });
    });

    test('should apply authentication to all routes', () => {
      // Verificar que el middleware de auth se usa en el router
      const hasAuthMiddleware = UsuarioRoutes.stack.some(layer => {
        return layer.name === 'authMiddleware' || layer.handle === authMiddleware;
      });

      expect(hasAuthMiddleware).toBe(true);
      expect(authMiddleware).toHaveBeenCalled();
    });
  });

  describe('Route Integration', () => {
    test('should call correct controller methods for each route', async () => {
      // Mock para cada controlador
      UsuarioController.healthCheck.mockImplementation((req, res) => res.status(200).json({ success: true }));
      UsuarioController.obtenerUsuarios.mockImplementation((req, res) => res.status(200).json({ success: true }));
      UsuarioController.obtenerRoles.mockImplementation((req, res) => res.status(200).json({ success: true }));
      UsuarioController.obtenerEstadisticas.mockImplementation((req, res) => res.status(200).json({ success: true }));
      UsuarioController.obtenerUsuarioPorId.mockImplementation((req, res) => res.status(200).json({ success: true }));
      UsuarioController.crearUsuario.mockImplementation((req, res) => res.status(201).json({ success: true }));
      UsuarioController.actualizarUsuario.mockImplementation((req, res) => res.status(200).json({ success: true }));
      UsuarioController.eliminarUsuario.mockImplementation((req, res) => res.status(200).json({ success: true }));

      // Testear cada ruta
      await request(app).get('/api/health');
      expect(UsuarioController.healthCheck).toHaveBeenCalled();

      await request(app).get('/api/usuarios');
      expect(UsuarioController.obtenerUsuarios).toHaveBeenCalled();

      await request(app).get('/api/usuarios/roles');
      expect(UsuarioController.obtenerRoles).toHaveBeenCalled();

      await request(app).get('/api/usuarios/estadisticas');
      expect(UsuarioController.obtenerEstadisticas).toHaveBeenCalled();

      await request(app).get('/api/usuarios/1');
      expect(UsuarioController.obtenerUsuarioPorId).toHaveBeenCalled();

      await request(app).post('/api/usuarios').send({ nombre: 'Test', email: 'test@test.com' });
      expect(UsuarioController.crearUsuario).toHaveBeenCalled();

      await request(app).put('/api/usuarios/1').send({ nombre: 'Updated' });
      expect(UsuarioController.actualizarUsuario).toHaveBeenCalled();

      await request(app).delete('/api/usuarios/1');
      expect(UsuarioController.eliminarUsuario).toHaveBeenCalled();
    });
  });
});