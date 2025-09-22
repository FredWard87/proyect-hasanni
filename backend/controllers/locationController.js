const { query } = require('../config/database');

// Guardar/actualizar ubicación del usuario
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, accuracy, timestamp } = req.body;
    const userId = req.user.userId;

    // Validar datos de entrada
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitud y longitud son requeridas'
      });
    }

    // Validar rangos de coordenadas
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Latitud debe estar entre -90 y 90'
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Longitud debe estar entre -180 y 180'
      });
    }

    // Actualizar ubicación en la base de datos
    const updateTime = timestamp ? new Date(timestamp) : new Date();
    
    const result = await query(
      `UPDATE usuarios 
       SET current_latitude = $1, 
           current_longitude = $2, 
           last_location_update = $3 
       WHERE id = $4 
       RETURNING id, nombre, email, current_latitude, current_longitude, last_location_update`,
      [parseFloat(latitude), parseFloat(longitude), updateTime, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const usuario = result.rows[0];

    // Log para seguimiento
    console.log(`📍 Ubicación actualizada para usuario ${usuario.nombre}:`, {
      latitude: usuario.current_latitude,
      longitude: usuario.current_longitude,
      accuracy,
      timestamp: updateTime
    });

    res.json({
      success: true,
      message: 'Ubicación actualizada correctamente',
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        location: {
          latitude: usuario.current_latitude,
          longitude: usuario.current_longitude,
          lastUpdate: usuario.last_location_update,
          accuracy
        }
      }
    });

  } catch (error) {
    console.error('Error actualizando ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener ubicación actual del usuario
exports.getMyLocation = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      `SELECT id, nombre, email, current_latitude, current_longitude, last_location_update 
       FROM usuarios 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const usuario = result.rows[0];

    res.json({
      success: true,
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        location: {
          latitude: usuario.current_latitude,
          longitude: usuario.current_longitude,
          lastUpdate: usuario.last_location_update,
          hasLocation: !!(usuario.current_latitude && usuario.current_longitude)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener usuarios cercanos (solo para administradores)
exports.getNearbyUsers = async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.query; // Radio en metros, default 5km
    const userId = req.user.userId;
    const userRole = req.user.rol;

    // Solo admins pueden ver ubicaciones de otros usuarios
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver ubicaciones de otros usuarios'
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitud y longitud son requeridas'
      });
    }

    // Usar fórmula Haversine para calcular distancia
    const result = await query(`
      SELECT 
        id,
        nombre,
        email,
        rol,
        current_latitude,
        current_longitude,
        last_location_update,
        (
          6371000 * acos(
            cos(radians($1)) * cos(radians(current_latitude)) *
            cos(radians(current_longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(current_latitude))
          )
        ) AS distance
      FROM usuarios
      WHERE 
        current_latitude IS NOT NULL 
        AND current_longitude IS NOT NULL
        AND id != $4
        AND (
          6371000 * acos(
            cos(radians($1)) * cos(radians(current_latitude)) *
            cos(radians(current_longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(current_latitude))
          )
        ) <= $3
      ORDER BY distance ASC
    `, [parseFloat(latitude), parseFloat(longitude), parseFloat(radius), userId]);

    const nearbyUsers = result.rows.map(user => ({
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      location: {
        latitude: user.current_latitude,
        longitude: user.current_longitude,
        lastUpdate: user.last_location_update
      },
      distance: Math.round(user.distance) // Distancia en metros
    }));

    res.json({
      success: true,
      message: `Encontrados ${nearbyUsers.length} usuarios en un radio de ${radius}m`,
      data: nearbyUsers,
      searchParams: {
        center: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
        radius: parseFloat(radius)
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuarios cercanos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de ubicación (para admins)
exports.getLocationStats = async (req, res) => {
  try {
    const userRole = req.user.rol;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver estadísticas de ubicación'
      });
    }

    const stats = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(current_latitude) as users_with_location,
        COUNT(CASE WHEN last_location_update > NOW() - INTERVAL '1 hour' THEN 1 END) as active_last_hour,
        COUNT(CASE WHEN last_location_update > NOW() - INTERVAL '24 hours' THEN 1 END) as active_last_day,
        AVG(current_latitude) as avg_latitude,
        AVG(current_longitude) as avg_longitude
      FROM usuarios
    `);

    const recentActivity = await query(`
      SELECT 
        DATE_TRUNC('hour', last_location_update) as hour,
        COUNT(*) as updates_count
      FROM usuarios
      WHERE last_location_update > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', last_location_update)
      ORDER BY hour DESC
    `);

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers: parseInt(stats.rows[0].total_users),
          usersWithLocation: parseInt(stats.rows[0].users_with_location),
          activeLastHour: parseInt(stats.rows[0].active_last_hour),
          activeLastDay: parseInt(stats.rows[0].active_last_day),
          averageCenter: {
            latitude: stats.rows[0].avg_latitude ? parseFloat(stats.rows[0].avg_latitude) : null,
            longitude: stats.rows[0].avg_longitude ? parseFloat(stats.rows[0].avg_longitude) : null
          }
        },
        recentActivity: recentActivity.rows.map(row => ({
          hour: row.hour,
          updates: parseInt(row.updates_count)
        }))
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Eliminar ubicación del usuario (borrar datos de ubicación)
exports.deleteLocation = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      `UPDATE usuarios 
       SET current_latitude = NULL, 
           current_longitude = NULL, 
           last_location_update = NULL 
       WHERE id = $1 
       RETURNING id, nombre, email`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Datos de ubicación eliminados correctamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error eliminando ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};