const notificationService = require('../services/notificationService');
const { query } = require('../config/database');

exports.getUserNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    let params = [req.user.userId];
    let paramCount = 1;

    if (unreadOnly === 'true') {
      paramCount++;
      whereClause += ` AND leida = false`;
    }

    paramCount++;
    whereClause += ` ORDER BY fecha_creacion DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const result = await query(
      `SELECT * FROM notificaciones ${whereClause}`,
      params
    );

    // Contar total para paginación
    const countResult = await query(
      'SELECT COUNT(*) FROM notificaciones WHERE user_id = $1',
      [req.user.userId]
    );

    res.json({
      success: true,
      notifications: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    await query(
      'UPDATE notificaciones SET leida = true, fecha_leida = NOW() WHERE id = $1 AND user_id = $2',
      [notificationId, req.user.userId]
    );

    res.json({ success: true, message: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await query(
      'UPDATE notificaciones SET leida = true, fecha_leida = NOW() WHERE user_id = $1 AND leida = false',
      [req.user.userId]
    );

    res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('Error marcando notificaciones como leídas:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const result = await query(
      'SELECT COUNT(*) FROM notificaciones WHERE user_id = $1 AND leida = false',
      [req.user.userId]
    );

    res.json({ 
      success: true, 
      unreadCount: parseInt(result.rows[0].count) 
    });
  } catch (error) {
    console.error('Error obteniendo conteo de no leídas:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { userId, tipo, titulo, mensaje, datosAdicionales, priority } = req.body;

    const notification = await notificationService.createNotification({
      userId,
      tipo,
      titulo,
      mensaje,
      datosAdicionales,
      priority
    });

    res.status(201).json({ success: true, notification });
  } catch (error) {
    console.error('Error creando notificación:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Ejemplos de notificaciones automáticas
exports.triggerTestNotification = async (req, res) => {
  try {
    const notification = await notificationService.createNotification({
      userId: req.user.userId,
      tipo: 'sistema',
      titulo: 'Notificación de prueba',
      mensaje: 'Esta es una notificación de prueba del sistema',
      priority: 'normal'
    });

    res.json({ success: true, notification, message: 'Notificación de prueba enviada' });
  } catch (error) {
    console.error('Error en notificación de prueba:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};