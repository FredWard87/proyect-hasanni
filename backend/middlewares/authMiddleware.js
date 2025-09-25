const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

module.exports = (req, res, next) => {
  console.log('🔐 === AUTH MIDDLEWARE START ===');
  console.log('📝 Path:', req.path);
  console.log('🔍 Headers authorization:', req.headers.authorization ? 'Present' : 'Missing');

  // Excluir rutas públicas de la autenticación
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
  
  if (publicRoutes.includes(req.path)) {
    console.log('✅ Ruta pública, skipping auth');
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No token provided');
    return res.status(401).json({ 
      success: false,
      message: 'Token no proporcionado' 
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    console.log('🔑 Verifying token...');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('✅ Token decodificado:', {
      userId: decoded.userId,
      email: decoded.email,
      rol: decoded.rol
    });
    
    // ✅ CORREGIDO: Estructura SIMPLE y consistente
    req.user = {
      userId: parseInt(decoded.userId), // ✅ Asegurar que sea número
      email: decoded.email,
      rol: decoded.rol,
      nombre: decoded.nombre
    };

    console.log('👤 Usuario establecido en req.user:', req.user);
    console.log('🔐 === AUTH MIDDLEWARE END ===');
    
    next();
  } catch (err) {
    console.error('❌ Error verifying token:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expirado' 
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token inválido' 
      });
    } else {
      return res.status(401).json({ 
        success: false,
        message: 'Error de autenticación' 
      });
    }
  }
};