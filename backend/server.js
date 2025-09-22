const express = require('express');

const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const passport = require('./passport');
const paymentsRoutes = require('./routes/paymentsRoutes');


// Inicializar Passport

// Importar configuración de base de datos
const { testConnection } = require('./config/database');

// Importar rutas
const apiRoutes = require('./routes/UsuarioRoutes');

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;

// Cargar documentación Swagger
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

// === MIDDLEWARE ===

// CORS - Permitir solicitudes del frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Para parsing de JSON y datos de formularios
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/auth', authRoutes);
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
      documentation: '/api-docs'
    }
  });
});

// Documentación Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rutas API
app.use('/api', apiRoutes);
app.use('/api/pagos', paymentsRoutes);



// === MANEJO DE ERRORES ===

// Ruta 404 para API endpoints - USAR EXPRESIÓN REGULAR
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

// Ruta 404 general - USAR EXPRESIÓN REGULAR
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
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('🚀 ===============================================');
      console.log('🚀 BACKEND API - Servidor iniciado exitosamente');
      console.log('🚀 ===============================================');
      console.log(`📊 Puerto: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
      console.log(`👥 Usuarios API: http://localhost:${PORT}/api/usuarios`);
      console.log(`📚 Documentación: http://localhost:${PORT}/api-docs`);
      console.log(`🌍 CORS habilitado para: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`📝 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log('🚀 ===============================================');
      console.log('');
      console.log('Para detener el servidor presiona Ctrl+C');
    });
    
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