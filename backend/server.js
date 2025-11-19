const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const passport = require('./passport');
const paymentsRoutes = require('./routes/paymentsRoutes');

// Importar configuración de base de datos
const { testConnection } = require('./config/database');

// Importar rutas
const apiRoutes = require('./routes/UsuarioRoutes');
const locationRoutes = require('./routes/locationRoutes');
const preferencesRoutes = require('./routes/preferencesRoutes');
const biometricRoutes = require('./routes/biometricRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const excelReportRoutes = require('./routes/excelReportRoutes');


// Middleware de autenticación
const authMiddleware = require('./middlewares/authMiddleware');

// Servicio de notificaciones
const notificationService = require('./services/notificationService');

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;

// Cargar documentación Swagger
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

// === MIDDLEWARE ===

// CORS - Permitir solicitudes del frontend
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://proyect-hasanni.onrender.com',
    'https://proyect-hasanni-backedn.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'ngrok-skip-browser-warning' 
  ],
  credentials: true
}));

// Bypass ngrok warning page
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Para parsing de JSON y datos de formularios
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas de autenticación (ambas versiones para compatibilidad)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes); // ← AGREGADO: Compatibilidad con frontend

app.use(passport.initialize());

// Logging de requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path}`);
  next();
});

// === RUTAS ===

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'API de Usuarios - Backend funcionando',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      usuarios: '/api/usuarios',
      roles: '/api/usuarios/roles',
      estadisticas: '/api/usuarios/estadisticas',
      documentation: '/api-docs',
      notifications: '/api/notifications',
      inventario: '/api/inventario',
      reportes: '/api/reportes',
      auth: '/api/auth (también disponible en /auth)'
    }
  });
});

// Documentación Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rutas públicas (sin autenticación)
app.use('/api/biometric', biometricRoutes);

// Rutas API
app.use('/api', apiRoutes);
app.use('/api/pagos', paymentsRoutes);

// Rutas con autenticación
app.use('/api/location', authMiddleware, locationRoutes);
app.use('/api/preferencias', preferencesRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);

// Rutas de inventario
app.use('/api/inventario', authMiddleware, inventoryRoutes);
app.use('/api/reportes', authMiddleware, reportRoutes);
app.use('/api/reportes/excel', authMiddleware, excelReportRoutes);


// === MANEJO DE ERRORES ===

// Ruta 404 para API endpoints
app.use(/^\/api\//, (req, res, next) => {
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      message: 'Endpoint de API no encontrado',
      path: req.originalUrl,
      method: req.method,
      suggestion: 'Verifica que la URL sea correcta'
    });
  } else {
    next();
  }
});

// Ruta 404 general
app.use(/.*/, (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl,
    suggestion: 'Las rutas de API comienzan con /api/'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'JSON malformado',
      error: 'Verifica la sintaxis del JSON enviado'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
  });
});

// === INICIAR SERVIDOR ===

const iniciarServidor = async () => {
  try {
    // Probar conexión a base de datos
    await testConnection();
    
    // Iniciar servidor HTTP para Socket.IO
    const server = require('http').createServer(app);
    
    // Inicializar servicio de notificaciones
    notificationService.initialize(server);
    
    // Iniciar servidor
    server.listen(PORT, () => {
      console.log('🚀 ===============================================');
      console.log('🚀 BACKEND API - Servidor iniciado exitosamente');
      console.log('🚀 ===============================================');
      console.log(`📊 Puerto: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
      console.log(`👥 Usuarios API: http://localhost:${PORT}/api/usuarios`);
      console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth (también /auth)`);
      console.log(`📚 Documentación: http://localhost:${PORT}/api-docs`);
      console.log(`🔔 Notificaciones: http://localhost:${PORT} (WebSocket)`);
      console.log(`📦 Inventario API: http://localhost:${PORT}/api/inventario`);
      console.log(`📊 Reportes API: http://localhost:${PORT}/api/reportes`);
      console.log(`🌍 CORS habilitado para: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`📝 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log('🚀 ===============================================');
      console.log('');
      console.log('Para detener el servidor presiona Ctrl+C');
    });
    
    return server;
    
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error.message);
    process.exit(1);
  }
};

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recibido, cerrando servidor...');
  process.exit(0);
});

// Iniciar servidor
iniciarServidor();