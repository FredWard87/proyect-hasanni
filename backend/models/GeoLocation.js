const { query } = require('../config/database');
const axios = require('axios');

class GeoLocationService {
  constructor() {
    this.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  }

  // Guardar ubicación del usuario
  async saveUserLocation(userId, locationData) {
    try {
      const {
        latitude,
        longitude,
        accuracy = null,
        address = null,
        city = null,
        country = null,
        countryCode = null,
        postalCode = null,
        ip_address = null,
        source = 'gps'
      } = locationData;

      // Validar coordenadas
      if (!this.isValidCoordinates(latitude, longitude)) {
        throw new Error('Coordenadas inválidas');
      }

      // Insertar nueva ubicación
      const result = await query(`
        INSERT INTO user_locations 
        (user_id, latitude, longitude, accuracy, address, city, country, country_code, postal_code, ip_address, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        userId, latitude, longitude, accuracy,
        address, city, country, countryCode, postalCode, ip_address, source
      ]);

      // Actualizar ubicación actual del usuario
      await query(`
        UPDATE usuarios 
        SET current_latitude = $1, current_longitude = $2, last_location_update = NOW()
        WHERE id = $3
      `, [latitude, longitude, userId]);

      console.log(`📍 Ubicación guardada para usuario ${userId}: ${city || 'Sin ciudad'}, ${country || 'Sin país'}`);
      return result.rows[0];

    } catch (error) {
      console.error('Error guardando ubicación:', error);
      throw error;
    }
  }

  // Obtener ubicación por IP
  async getLocationByIP(ipAddress) {
    try {
      if (!ipAddress || ipAddress === 'unknown' || ipAddress === '::1' || ipAddress.startsWith('127.')) {
        throw new Error('IP local o inválida');
      }

      const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`, {
        timeout: 5000
      });

      if (response.data.error) {
        throw new Error(response.data.reason || 'Error obteniendo ubicación por IP');
      }

      return {
        latitude: parseFloat(response.data.latitude),
        longitude: parseFloat(response.data.longitude),
        city: response.data.city,
        country: response.data.country_name,
        countryCode: response.data.country_code,
        postalCode: response.data.postal,
        source: 'ip'
      };

    } catch (error) {
      console.error('Error obteniendo ubicación por IP:', error);
      // Fallback para ubicación por defecto
      return {
        latitude: 0,
        longitude: 0,
        city: 'Unknown',
        country: 'Unknown',
        countryCode: 'XX',
        source: 'ip_fallback'
      };
    }
  }

  // Geocodificación reversa (coordenadas a dirección)
  async reverseGeocode(latitude, longitude) {
    try {
      if (!this.GOOGLE_MAPS_API_KEY) {
        console.log('Google Maps API key no configurada, saltando geocodificación reversa');
        return null;
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.GOOGLE_MAPS_API_KEY,
          language: 'es'
        },
        timeout: 5000
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error('No se pudo obtener la dirección');
      }

      const result = response.data.results[0];
      const components = result.address_components;

      return {
        address: result.formatted_address,
        city: this.extractAddressComponent(components, 'locality') || 
              this.extractAddressComponent(components, 'administrative_area_level_2'),
        country: this.extractAddressComponent(components, 'country'),
        countryCode: this.extractAddressComponent(components, 'country', 'short_name'),
        postalCode: this.extractAddressComponent(components, 'postal_code')
      };

    } catch (error) {
      console.error('Error en geocodificación reversa:', error);
      return null;
    }
  }

  // Obtener usuarios cercanos
  async getNearbyUsers(userId, radiusKm = 10, limit = 20) {
    try {
      const userLocationResult = await query(
        'SELECT current_latitude, current_longitude FROM usuarios WHERE id = $1',
        [userId]
      );

      if (userLocationResult.rows.length === 0 || 
          !userLocationResult.rows[0].current_latitude) {
        throw new Error('Usuario sin ubicación registrada');
      }

      const { current_latitude: userLat, current_longitude: userLon } = userLocationResult.rows[0];

      const nearbyUsers = await query(`
        SELECT 
          u.id, u.nombre, u.email, u.rol,
          u.current_latitude, u.current_longitude,
          u.last_location_update,
          (6371 * acos(
            cos(radians($2)) * cos(radians(u.current_latitude)) *
            cos(radians(u.current_longitude) - radians($3)) +
            sin(radians($2)) * sin(radians(u.current_latitude))
          )) AS distance_km
        FROM usuarios u
        WHERE u.id != $1 
          AND u.current_latitude IS NOT NULL 
          AND u.current_longitude IS NOT NULL
          AND (6371 * acos(
            cos(radians($2)) * cos(radians(u.current_latitude)) *
            cos(radians(u.current_longitude) - radians($3)) +
            sin(radians($2)) * sin(radians(u.current_latitude))
          )) <= $4
        ORDER BY distance_km
        LIMIT $5
      `, [userId, userLat, userLon, radiusKm, limit]);

      return nearbyUsers.rows;

    } catch (error) {
      console.error('Error obteniendo usuarios cercanos:', error);
      throw error;
    }
  }

  // Obtener historial de ubicaciones
  async getLocationHistory(userId, limit = 50) {
    try {
      const result = await query(`
        SELECT * FROM user_locations 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      console.error('Error obteniendo historial de ubicaciones:', error);
      throw error;
    }
  }

  // Validar coordenadas
  isValidCoordinates(latitude, longitude) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    
    return !isNaN(lat) && !isNaN(lon) &&
           lat >= -90 && lat <= 90 &&
           lon >= -180 && lon <= 180;
  }

  // Extraer componente de dirección
  extractAddressComponent(components, type, format = 'long_name') {
    const component = components.find(comp => comp.types.includes(type));
    return component ? component[format] : null;
  }
}

// Servicio para funcionalidades offline
class OfflineService {
  constructor() {
    this.CACHE_VERSION = process.env.CACHE_VERSION || 'v1';
  }

  // Obtener datos para modo offline
  async getOfflineData(userId) {
    try {
      const userData = await query(
        'SELECT id, nombre, email, rol, current_latitude, current_longitude FROM usuarios WHERE id = $1',
        [userId]
      );

      const usuariosList = await query(
        'SELECT id, nombre, email, rol, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC LIMIT 100'
      );

      const estadisticas = await query(`
        SELECT 
          rol, 
          COUNT(*) as cantidad
        FROM usuarios 
        GROUP BY rol 
        ORDER BY cantidad DESC
      `);

      return {
        user: userData.rows[0],
        usuarios: usuariosList.rows,
        estadisticas: estadisticas.rows,
        cached_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error obteniendo datos offline:', error);
      throw error;
    }
  }

  // Almacenar acción pendiente para sync
  async storePendingAction(userId, action, data) {
    try {
      await query(`
        INSERT INTO pending_sync_actions (user_id, action_type, action_data, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [userId, action, JSON.stringify(data)]);

      return { success: true };
    } catch (error) {
      console.error('Error almacenando acción pendiente:', error);
      throw error;
    }
  }

  // Procesar acciones pendientes
  async processPendingActions(userId) {
    try {
      const result = await query(
        'SELECT * FROM pending_sync_actions WHERE user_id = $1 AND processed_at IS NULL ORDER BY created_at',
        [userId]
      );

      const processed = [];
      const failed = [];

      for (const action of result.rows) {
        try {
          await this.processAction(action);
          
          await query(
            'UPDATE pending_sync_actions SET processed_at = NOW() WHERE id = $1', 
            [action.id]
          );
          processed.push(action.id);
        } catch (error) {
          await query(
            'UPDATE pending_sync_actions SET failed_attempts = failed_attempts + 1 WHERE id = $1',
            [action.id]
          );
          failed.push({ id: action.id, error: error.message });
        }
      }

      return { processed, failed };
    } catch (error) {
      console.error('Error procesando acciones pendientes:', error);
      throw error;
    }
  }

  // Procesar una acción específica
  async processAction(action) {
    const data = JSON.parse(action.action_data);
    const Usuario = require('./Usuario');
    
    switch (action.action_type) {
      case 'create_user':
        const usuario = new Usuario(null, data.nombre, data.email, data.password, data.rol);
        await usuario.guardar();
        break;
        
      case 'update_user':
        const usuarioUpdate = await Usuario.obtenerPorId(data.id);
        if (usuarioUpdate) {
          Object.assign(usuarioUpdate, data);
          await usuarioUpdate.actualizar();
        }
        break;
        
      case 'delete_user':
        const usuarioDelete = await Usuario.obtenerPorId(data.id);
        if (usuarioDelete) {
          await usuarioDelete.eliminar();
        }
        break;
        
      case 'update_location':
        const geoService = new GeoLocationService();
        await geoService.saveUserLocation(action.user_id, data);
        break;
        
      default:
        throw new Error(`Acción no reconocida: ${action.action_type}`);
    }
  }
}

module.exports = {
  GeoLocationService,
  OfflineService
};