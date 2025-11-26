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

// Manejar preflight OPTIONS para todos los routes
app.options('*', cors());

// CORS UNIVERSAL - Funciona en todos los SO/navegadores
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, curl, postman, etc.)
    if (!origin) return callback(null, true);
    
    // Lista completa de orígenes permitidos
    const allowedOrigins = [
      'https://proyect-hasanni.onrender.com',
      'https://proyect-hasami.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://192.168.1.100:3000',
      'http://192.168.1.100:3001',
      'http://10.0.2.2:3000', // Android emulator
      'http://10.0.2.2:3001'
    ];
    
    // Verificar si el origen está permitido o es un subdominio de render.com
    if (allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      console.log('⚠️  Origen no listado pero permitido temporalmente:', origin);
      callback(null, true); // Temporalmente permitir todos para debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'ngrok-skip-browser-warning',
    'x-auth-token',
    'x-app-version'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-Total-Count'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 horas para preflight cache
}));

// Headers CORS manuales (backup para Safari/iOS)
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://proyect-hasanni.onrender.com',
    'https://proyect-hasami.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ];
  
  const origin = req.headers.origin;
  
  // Establecer header Access-Control-Allow-Origin dinámicamente
  if (allowedOrigins.includes(origin) || (origin && origin.endsWith('.onrender.com'))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Permitir requests sin origin
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Request-Method, Access-Control-Request-Headers, ngrok-skip-browser-warning, x-auth-token');
  res.header('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range, X-Total-Count');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Vary', 'Origin'); // Importante para cache de CORS
  
  // Headers de seguridad adicionales
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Bypass para ngrok y otros servicios
  res.header('ngrok-skip-browser-warning', 'true');
  
  // Manejar preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware específico para problemas de Safari/iOS
app.use((req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const isSafari = /safari|iphone|ipad|ipod/i.test(userAgent) && !/chrome/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  
  if (isSafari || isIOS) {
    console.log('🌐 Request desde Safari/iOS detectado:', userAgent);
    // Headers adicionales para Safari
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  
  next();
});

// Para parsing de JSON y datos de formularios
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas de autenticación (ambas versiones para compatibilidad)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use(passport.initialize());

// Logging de requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'} - User-Agent: ${req.get('User-Agent')?.substring(0, 50) || 'No UA'}`);
  next();
});

// === RUTAS ===

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'API de Usuarios - Backend funcionando',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: {
      enabled: true,
      origins: [
        'https://proyect-hasanni.onrender.com',
        'https://proyect-hasami.onrender.com',
        'http://localhost:3000'
      ]
    },
    endpoints: {
      health: '/api/health',
      usuarios: '/api/usuarios',
      usuarios: '/usuarios',
      roles: '/api/usuarios/roles',
      roles: '/usuarios/roles',
      estadisticas: '/api/usuarios/estadisticas',
      documentation: '/api-docs',
      notifications: '/api/notifications',
      inventario: '/api/inventario',
      inventario: '/inventario',
      reportes: '/api/reportes',
      reportes: '/reportes',
      auth: '/api/auth (también disponible en /auth)'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Documentación Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rutas públicas (sin autenticación)
app.use('/api/biometric', biometricRoutes);
app.use('/biometric', biometricRoutes);

// Rutas API
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

app.use('/api/pagos', paymentsRoutes);
app.use('/pagos', paymentsRoutes);

// Rutas con autenticación
app.use('/api/location', authMiddleware, locationRoutes);
app.use('/location', authMiddleware, locationRoutes);

app.use('/api/preferencias', preferencesRoutes);
app.use('/preferencias', preferencesRoutes);

app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/notifications', authMiddleware, notificationRoutes);

// Rutas de inventario
app.use('/api/inventario', authMiddleware, inventoryRoutes);
app.use('/inventario', authMiddleware, inventoryRoutes);

app.use('/api/reportes', authMiddleware, reportRoutes);
app.use('/reportes', authMiddleware, reportRoutes);

app.use('/api/reportes/excel', authMiddleware, excelReportRoutes);
app.use('/reportes/excel', authMiddleware, excelReportRoutes);

// === MANEJO DE ERRORES ===

// Ruta 404 para API endpoints
app.use(/^\/api\//, (req, res, next) => {
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      message: 'Endpoint de API no encontrado',
      path: req.originalUrl,
      method: req.method,
      suggestion: 'Verifica que la URL sea correcta',
      availableEndpoints: {
        auth: ['/api/auth/login', '/api/auth/register', '/api/auth/verify-token'],
        users: ['/api/usuarios', '/api/usuarios/roles'],
        inventory: ['/api/inventario'],
        reports: ['/api/reportes'],
        biometric: ['/api/biometric']
      }
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
    suggestion: 'Las rutas de API comienzan con /api/',
    healthCheck: '/health',
    documentation: '/api-docs'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error global:', err);
  
  // Log detallado del error
  console.error('Error details:', {
    method: req.method,
    path: req.path,
    origin: req.headers.origin,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    body: req.body
  });
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'JSON malformado',
      error: 'Verifica la sintaxis del JSON enviado'
    });
  }
  
  // Manejar errores de CORS
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'Acceso bloqueado por política CORS',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Contacta al administrador'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno',
    requestId: Date.now().toString(36) + Math.random().toString(36).substr(2)
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
      console.log(`🌐 URL Production: https://proyect-hasami.onrender.com`);
      console.log(`🔗 Frontend: https://proyect-hasanni.onrender.com`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
      console.log(`📚 Documentación: http://localhost:${PORT}/api-docs`);
      console.log(`🔔 Notificaciones: http://localhost:${PORT} (WebSocket)`);
      console.log(`📦 Inventario API: http://localhost:${PORT}/api/inventario`);
      console.log(`📊 Reportes API: http://localhost:${PORT}/api/reportes`);
      console.log(`🌍 CORS habilitado para múltiples orígenes`);
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

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('💥 Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promise rechazada no manejada:', reason);
  process.exit(1);
});

// Iniciar servidor
iniciarServidor();
