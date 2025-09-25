// controllers/locationController.js
const Usuario = require('../models/Usuario');
const notificationMiddleware = require('../middlewares/notificationMiddleware');

class LocationController {
  
  // POST /api/usuarios/ubicacion - Actualizar ubicación
  static async updateLocation(req, res) {
    try {
      // ✅ CORREGIDO: Verificar que req.user existe
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const userId = req.user.userId;
      const { latitude, longitude, accuracy, timestamp } = req.body;
      
      console.log('📍 Actualizando ubicación para usuario:', userId);
      console.log('📊 Datos recibidos:', { latitude, longitude, accuracy, timestamp });
      
      // Validaciones mejoradas
      if (typeof latitude !== 'number' || isNaN(latitude) || 
          typeof longitude !== 'number' || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          message: 'Latitude y longitude deben ser números válidos'
        });
      }

      // Validar rangos de coordenadas
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          message: 'Coordenadas fuera de rango válido'
        });
      }

      // Actualizar ubicación en la base de datos
      await Usuario.actualizarUbicacion(userId, {
        latitude,
        longitude,
        accuracy: accuracy || 0,
        timestamp: timestamp || new Date().toISOString()
      });

      // Notificar al usuario sobre la actualización de ubicación
      await notificationMiddleware.onUserDataModified(
        req.user.userId,
        userId,
        { tipo: 'ubicacion', mensaje: 'Ubicación actualizada correctamente' }
      );

      res.json({
        success: true,
        message: 'Ubicación actualizada exitosamente',
        data: {
          latitude,
          longitude,
          accuracy: accuracy || 0,
          timestamp: timestamp || new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error al actualizar ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar ubicación',
        error: error.message
      });
    }
  }

  // GET /api/usuarios/mi-ubicacion - Obtener mi ubicación actual
  static async getMyLocation(req, res) {
    try {
      // ✅ CORREGIDO: Verificar que req.user existe
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const userId = req.user.userId;
      
      const usuario = await Usuario.obtenerPorId(userId);
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      if (!usuario.current_latitude || !usuario.current_longitude) {
        return res.status(404).json({
          success: false,
          message: 'No se ha registrado ubicación para este usuario'
        });
      }
      
      res.json({
        success: true,
        data: {
          latitude: usuario.current_latitude,
          longitude: usuario.current_longitude,
          accuracy: usuario.ubicacion_accuracy || 0,
          lastUpdate: usuario.ubicacion_actualizada || usuario.fecha_creacion
        }
      });
      
    } catch (error) {
      console.error('❌ Error al obtener ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener ubicación',
        error: error.message
      });
    }
  }

  // GET /api/usuarios/cercanos - Obtener usuarios cercanos (solo admins)
  static async getNearbyUsers(req, res) {
    try {
      // ✅ CORREGIDO: Verificar que req.user existe y es admin
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Se requieren permisos de administrador'
        });
      }

      const { radius = 10 } = req.query;
      
      // Obtener todos los usuarios con ubicación
      const usuarios = await Usuario.obtenerTodos();
      
      // Filtrar usuarios con ubicación válida
      const usuariosConUbicacion = usuarios.filter(user => 
        user.current_latitude && user.current_longitude
      );

      res.json({
        success: true,
        data: usuariosConUbicacion,
        total: usuariosConUbicacion.length,
        radius: parseFloat(radius)
      });
      
    } catch (error) {
      console.error('❌ Error al obtener usuarios cercanos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios cercanos',
        error: error.message
      });
    }
  }

  // GET /api/usuarios/estadisticas-ubicacion - Estadísticas de ubicación (solo admins)
  static async getLocationStats(req, res) {
    try {
      // ✅ CORREGIDO: Verificar que req.user existe y es admin
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Se requieren permisos de administrador'
        });
      }

      const usuarios = await Usuario.obtenerTodos();
      
      // Calcular estadísticas
      const usuariosConUbicacion = usuarios.filter(user => 
        user.current_latitude && user.current_longitude
      );

      const usuariosActivos24h = usuariosConUbicacion.filter(user => {
        const lastUpdate = new Date(user.ubicacion_actualizada || user.fecha_creacion);
        const now = new Date();
        const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
        return diffHours <= 24;
      });

      // Agrupar por región (simplificado)
      const regiones = {};
      usuariosConUbicacion.forEach(user => {
        // Simulación de agrupación por coordenadas aproximadas
        const regionKey = user.current_latitude.toFixed(1) + ',' + user.current_longitude.toFixed(1);
        regiones[regionKey] = (regiones[regionKey] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          totalUsuariosConUbicacion: usuariosConUbicacion.length,
          usuariosActivos24h: usuariosActivos24h.length,
          promedioActualizacionesDiarias: usuariosConUbicacion.length > 0 ? 
            (usuariosActivos24h.length / usuariosConUbicacion.length).toFixed(1) : 0,
          regiones: regiones,
          totalUsuarios: usuarios.length
        }
      });
      
    } catch (error) {
      console.error('❌ Error al obtener estadísticas de ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas de ubicación',
        error: error.message
      });
    }
  }

  // DELETE /api/usuarios/ubicacion - Eliminar datos de ubicación del usuario
  static async deleteLocation(req, res) {
    try {
      // ✅ CORREGIDO: Verificar que req.user existe
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const userId = req.user.userId;
      
      // Eliminar ubicación estableciendo valores a null
      await Usuario.actualizarUbicacion(userId, {
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: null
      });

      // Notificar eliminación de ubicación
      await notificationMiddleware.onUserDataModified(
        req.user.userId,
        userId,
        { tipo: 'ubicacion_eliminada', mensaje: 'Datos de ubicación eliminados' }
      );

      res.json({
        success: true,
        message: 'Datos de ubicación eliminados exitosamente'
      });
      
    } catch (error) {
      console.error('❌ Error al eliminar ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar datos de ubicación',
        error: error.message
      });
    }
  }
}

module.exports = LocationController;