const { GeoLocationService, OfflineService } = require('../models/GeoLocation');

class GeoOfflineController {
  constructor() {
    this.geoService = new GeoLocationService();
    this.offlineService = new OfflineService();
  }

  // Guardar ubicación del usuario
  saveUserLocation = async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      const {
        latitude,
        longitude,
        accuracy,
        address,
        city,
        country,
        countryCode,
        postalCode
      } = req.body;

      // Obtener IP del cliente
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      const realIp = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress.split(',')[0];

      let locationData = {
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        accuracy: accuracy ? parseFloat(accuracy) : null,
        address,
        city,
        country,
        countryCode,
        postalCode,
        ip_address: realIp,
        source: 'gps'
      };

      // Si no hay coordenadas GPS, obtener por IP
      if (!locationData.latitude || !locationData.longitude) {
        try {
          const ipLocation = await this.geoService.getLocationByIP(realIp);
          locationData = { ...locationData, ...ipLocation };
        } catch (error) {
          console.error('Error obteniendo ubicación por IP:', error);
        }
      }

      // Si tenemos coordenadas pero no dirección, hacer geocodificación reversa
      if (locationData.latitude && locationData.longitude && !locationData.address) {
        try {
          const addressInfo = await this.geoService.reverseGeocode(
            locationData.latitude,
            locationData.longitude
          );
          if (addressInfo) {
            locationData = { ...locationData, ...addressInfo };
          }
        } catch (error) {
          console.error('Error en geocodificación reversa:', error);
        }
      }

      const savedLocation = await this.geoService.saveUserLocation(userId, locationData);

      res.json({
        success: true,
        message: 'Ubicación guardada exitosamente',
        data: {
          id: savedLocation.id,
          latitude: savedLocation.latitude,
          longitude: savedLocation.longitude,
          city: savedLocation.city,
          country: savedLocation.country,
          source: savedLocation.source,
          created_at: savedLocation.created_at
        }
      });

    } catch (error) {
      console.error('Error guardando ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al guardar ubicación',
        error: error.message
      });
    }
  };

  // Obtener usuarios cercanos
  getNearbyUsers = async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      const radius = Math.min(parseInt(req.query.radius) || 10, 100); // máximo 100km
      const limit = Math.min(parseInt(req.query.limit) || 20, 50); // máximo 50 usuarios

      const nearbyUsers = await this.geoService.getNearbyUsers(userId, radius, limit);

      res.json({
        success: true,
        data: nearbyUsers.map(user => ({
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
          distance_km: parseFloat(user.distance_km).toFixed(2),
          last_location_update: user.last_location_update
        })),
        total: nearbyUsers.length,
        radius_km: radius
      });

    } catch (error) {
      console.error('Error obteniendo usuarios cercanos:', error);
      res.status(500).json({
        success: false,
        message: error.message.includes('sin ubicación') ? 
          'Necesitas compartir tu ubicación para encontrar usuarios cercanos' :
          'Error al buscar usuarios cercanos',
        error: error.message
      });
    }
  };

  // Obtener historial de ubicaciones del usuario
  getLocationHistory = async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);

      const history = await this.geoService.getLocationHistory(userId, limit);

      res.json({
        success: true,
        data: history,
        total: history.length
      });

    } catch (error) {
      console.error('Error obteniendo historial:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de ubicaciones',
        error: error.message
      });
    }
  };

  // Obtener datos para modo offline
  getOfflineData = async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      const offlineData = await this.offlineService.getOfflineData(userId);

      res.json({
        success: true,
        data: offlineData,
        cache_info: {
          version: this.offlineService.CACHE_VERSION,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
        }
      });

    } catch (error) {
      console.error('Error obteniendo datos offline:', error);
      res.status(500).json({
        success: false,
        message: 'Error al preparar datos offline',
        error: error.message
      });
    }
  };

  // Almacenar acción para sincronización posterior
  storePendingAction = async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      const { action_type, action_data } = req.body;

      if (!action_type || !action_data) {
        return res.status(400).json({
          success: false,
          message: 'action_type y action_data son requeridos'
        });
      }

      await this.offlineService.storePendingAction(userId, action_type, action_data);

      res.json({
        success: true,
        message: 'Acción almacenada para sincronización posterior'
      });

    } catch (error) {
      console.error('Error almacenando acción:', error);
      res.status(500).json({
        success: false,
        message: 'Error al almacenar acción',
        error: error.message
      });
    }
  };

  // Sincronizar acciones pendientes
  syncPendingActions = async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      const result = await this.offlineService.processPendingActions(userId);

      res.json({
        success: true,
        message: 'Sincronización completada',
        data: {
          processed: result.processed.length,
          failed: result.failed.length,
          details: result
        }
      });

    } catch (error) {
      console.error('Error sincronizando:', error);
      res.status(500).json({
        success: false,
        message: 'Error en la sincronización',
        error: error.message
      });
    }
  };

  // Obtener estadísticas geográficas
  getGeoStats = async (req, res) => {
    try {
      const stats = await this.geoService.getGeoStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas geo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas geográficas',
        error: error.message
      });
    }
  };

  // Generar manifiesto PWA
  generateManifest = (req, res) => {
    const manifest = {
      name: "Sistema de Usuarios",
      short_name: "Usuarios App",
      description: "Aplicación de gestión de usuarios con soporte offline y geolocalización",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#667eea",
      orientation: "portrait-primary",
      icons: [
        {
          src: "/icons/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: "/icons/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ],
      categories: ["productivity", "utilities"],
      lang: "es",
      dir: "ltr"
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.json(manifest);
  };

  // Generar Service Worker
  generateServiceWorker = (req, res) => {
    const serviceWorkerCode = `
const CACHE_NAME = 'v${this.offlineService.CACHE_VERSION}-usuarios-app';
const STATIC_CACHE = 'static-v${this.offlineService.CACHE_VERSION}';
const DYNAMIC_CACHE = 'dynamic-v${this.offlineService.CACHE_VERSION}';

const STATIC_FILES = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/offline.html'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static files');
        return cache.addAll(STATIC_FILES.filter(url => url !== '/'));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheName.includes('v${this.offlineService.CACHE_VERSION}')) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/') || 
                 caches.match('/offline.html') ||
                 new Response('Offline - Sin conexión', { status: 503 });
        })
    );
    return;
  }

  // Handle API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return new Response(JSON.stringify({
                success: false,
                message: 'Sin conexión. Datos no disponibles.',
                offline: true,
                timestamp: new Date().toISOString()
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }

  // Handle other requests (CSS, JS, images, etc.)
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(request, responseClone));
            }
            return response;
          });
      })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(syncPendingActions());
  }
});

// Sync pending actions
async function syncPendingActions() {
  try {
    console.log('Syncing pending actions...');
    
    const response = await fetch('/api/geo/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
      }
    });
    
    if (response.ok) {
      console.log('Sync successful');
    }
  } catch (error) {
    console.log('Sync failed:', error);
  }
}
    `;

    res.setHeader('Content-Type', 'application/javascript');
    res.send(serviceWorkerCode);
  };
}

module.exports = GeoOfflineController;