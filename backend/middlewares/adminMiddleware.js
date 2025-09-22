const { query } = require('../config/database');

module.exports = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Verificar si el usuario es administrador
    const userResult = await query(
      'SELECT es_admin FROM usuarios WHERE id = $1',
      [req.user.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].es_admin) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador'
      });
    }

    next();
  } catch (error) {
    console.error('Error en middleware de admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};