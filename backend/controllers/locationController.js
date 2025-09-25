const { query } = require('../config/database');

class LocationController {
  
  // POST /api/usuarios/ubicacion - Actualizar ubicación
  static async updateLocation(req, res) {
    try {
      const userId = req.user.userId;
      const { latitude, longitude, accuracy, timestamp } = req.body;
      
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Latitude y longitude son requeridos'
        });
      }

      if (typeof latitude !== 'number' || isNaN(latitude) || 
          typeof longitude !== 'number' || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          message: 'Latitude y longitude deben ser números válidos'
        });
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          message: 'Coordenadas fuera de rango válido'
        });
      }

      const result = await query(
        `UPDATE usuarios 
         SET current_latitude = $1, current_longitude = $2, 
             accuracy = $3, last_location_update = $4
         WHERE id = $5 
         RETURNING id, nombre, current_latitude, current_longitude, last_location_update`,
        [latitude, longitude, accuracy || 0, timestamp || new Date(), userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Ubicación actualizada exitosamente',
        data: {
          latitude: result.rows[0].current_latitude,
          longitude: result.rows[0].current_longitude,
          accuracy: accuracy || 0,
          timestamp: result.rows[0].last_location_update
        }
      });

    } catch (error) {
      console.error('Error al actualizar ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar ubicación'
      });
    }
  }

  // GET /api/usuarios/mi-ubicacion - Obtener mi ubicación actual
  static async getMyLocation(req, res) {
    try {
      console.log('=== GET MY LOCATION DEBUG ===');
      console.log('req.user:', req.user);
      console.log('userId:', req.user?.userId);
      
      const userId = req.user.userId;
      
      const result = await query(
        `SELECT id, nombre, current_latitude, current_longitude, 
                accuracy, last_location_update, fecha_creacion
         FROM usuarios WHERE id = $1`,
        [userId]
      );
      
      console.log('SQL result:', result.rows);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const usuario = result.rows[0];

      if (!usuario.current_latitude || !usuario.current_longitude) {
        return res.status(404).json({
          success: false,
          message: 'No se ha registrado ubicación para este usuario'
        });
      }

      res.json({
        success: true,
        data: {
          latitude: parseFloat(usuario.current_latitude),
          longitude: parseFloat(usuario.current_longitude),
          accuracy: usuario.accuracy || 0,
          lastUpdate: usuario.last_location_update || usuario.fecha_creacion
        }
      });
      
    } catch (error) {
      console.error('Error al obtener ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener ubicación'
      });
    }
  }

  // GET /api/usuarios/cercanos - Obtener usuarios cercanos
  static async getNearbyUsers(req, res) {
    try {
      console.log('=== GET NEARBY USERS DEBUG ===');
      console.log('req.user:', req.user);
      console.log('rol:', req.user?.rol);
      
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Se requieren permisos de administrador'
        });
      }

      const { radius = 10 } = req.query;
      
      const result = await query(
        `SELECT id, nombre, email, current_latitude, current_longitude, 
                accuracy, last_location_update, rol
         FROM usuarios 
         WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL`
      );
      
      res.json({
        success: true,
        data: result.rows,
        total: result.rows.length,
        radius: parseFloat(radius)
      });
      
    } catch (error) {
      console.error('Error al obtener usuarios cercanos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios cercanos'
      });
    }
  }

  // GET /api/usuarios/estadisticas-ubicacion - Estadísticas de ubicación
  static async getLocationStats(req, res) {
    try {
      console.log('=== GET LOCATION STATS DEBUG ===');
      console.log('req.user:', req.user);
      console.log('rol:', req.user?.rol);
      
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Se requieren permisos de administrador'
        });
      }

      const { radius = 10 } = req.query;
      const radiusNum = parseFloat(radius);
      
      if (isNaN(radiusNum) || radiusNum <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El parámetro radius debe ser un número mayor que 0'
        });
      }

      const usuariosResult = await query(
        'SELECT id, nombre, email, current_latitude, current_longitude, last_location_update, fecha_creacion FROM usuarios'
      );
      
      const usuarios = usuariosResult.rows;
      const usuariosConUbicacion = usuarios.filter(user => 
        user.current_latitude && user.current_longitude
      );

      const usuariosActivos24h = usuariosConUbicacion.filter(user => {
        try {
          const lastUpdate = new Date(user.last_location_update || user.fecha_creacion);
          const now = new Date();
          const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
          return diffHours <= 24;
        } catch (error) {
          return false;
        }
      });

      res.json({
        success: true,
        data: {
          totalUsuarios: usuarios.length,
          totalUsuariosConUbicacion: usuariosConUbicacion.length,
          usuariosActivos24h: usuariosActivos24h.length,
          usuariosSinUbicacion: usuarios.length - usuariosConUbicacion.length,
          promedioActualizacionesDiarias: usuariosConUbicacion.length > 0 ? 
            parseFloat((usuariosActivos24h.length / usuariosConUbicacion.length).toFixed(2)) : 0,
          radius: radiusNum,
          lastUpdated: new Date().toISOString()
        },
        message: 'Estadísticas de ubicación obtenidas exitosamente'
      });
      
    } catch (error) {
      console.error('Error al obtener estadísticas de ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas de ubicación'
      });
    }
  }

  // DELETE /api/usuarios/ubicacion - Eliminar datos de ubicación
  static async deleteLocation(req, res) {
    try {
      console.log('=== DELETE LOCATION DEBUG ===');
      console.log('req.user:', req.user);
      console.log('userId:', req.user?.userId);
      
      const userId = req.user.userId;
      
      const result = await query(
        `UPDATE usuarios 
         SET current_latitude = NULL, current_longitude = NULL, 
             accuracy = NULL, last_location_update = NULL
         WHERE id = $1 
         RETURNING id, nombre`,
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
        message: 'Datos de ubicación eliminados exitosamente'
      });
      
    } catch (error) {
      console.error('Error al eliminar ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar datos de ubicación'
      });
    }
  }
}

module.exports = LocationController;