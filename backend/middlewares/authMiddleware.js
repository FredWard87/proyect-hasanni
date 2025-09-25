const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

module.exports = (req, res, next) => {
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
     // ✅ AGREGADA
  ];
  
  // Usar includes en lugar de startsWith para coincidencia exacta
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      message: 'Token no proporcionado' 
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // Manejar diferentes tipos de errores del token
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