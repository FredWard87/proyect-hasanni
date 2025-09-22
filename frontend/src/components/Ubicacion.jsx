import React, { useState, useEffect, useCallback } from 'react';

const LocationManager = () => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    error: null,
    loading: false,
    permission: 'prompt'
  });

  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [showNearby, setShowNearby] = useState(false);
  const [user, setUser] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Guardar ubicación offline
  const saveLocationOffline = useCallback((coords) => {
    const locationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp: new Date().toISOString(),
      offline: true
    };
    
    try {
      localStorage.setItem('userLocation', JSON.stringify(locationData));
      const offlineQueue = JSON.parse(localStorage.getItem('offlineLocationQueue') || '[]');
      offlineQueue.push(locationData);
      localStorage.setItem('offlineLocationQueue', JSON.stringify(offlineQueue));
      console.log('📍 Ubicación guardada offline:', locationData);
    } catch (error) {
      console.error('Error guardando ubicación offline:', error);
    }
  }, []);

  // Guardar ubicación online
  const saveLocationOnline = useCallback(async (coords) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await fetch(`${API_URL}/usuarios/ubicacion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy
        })
      });

      if (response.ok) {
        console.log('🌐 Ubicación guardada en servidor');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error guardando ubicación online:', error);
      return false;
    }
  }, [API_URL]);

  // Manejar nueva posición
  const handlePosition = useCallback(async (position) => {
    const coords = position.coords;
    
    setLocation(prev => ({
      ...prev,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp: new Date().toISOString(),
      error: null,
      loading: false,
      permission: 'granted'
    }));

    // Siempre guardar offline como respaldo
    saveLocationOffline(coords);

    // Intentar guardar online si hay conexión
    if (navigator.onLine) {
      const saved = await saveLocationOnline(coords);
      if (!saved) {
        console.log('⚠️ Error guardando online, disponible offline');
      }
    } else {
      console.log('📱 Sin conexión, guardado offline únicamente');
    }
  }, [saveLocationOffline, saveLocationOnline]);

  // Manejar errores
  const handleError = useCallback((error) => {
    let errorMessage = '';
    let permission = 'denied';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permisos de ubicación denegados por el usuario';
        permission = 'denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Ubicación no disponible en este momento';
        permission = 'granted';
        break;
      case error.TIMEOUT:
        errorMessage = 'Tiempo de espera agotado para obtener ubicación';
        permission = 'granted';
        break;
      default:
        errorMessage = 'Error desconocido obteniendo ubicación';
        break;
    }

    setLocation(prev => ({
      ...prev,
      error: errorMessage,
      loading: false,
      permission
    }));

    console.error('❌ Error de geolocalización:', errorMessage);
  }, []);

  // Obtener ubicación actual
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        error: 'Geolocalización no soportada en este navegador',
        loading: false
      }));
      return;
    }

    setLocation(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutos
      }
    );
  }, [handlePosition, handleError]);

  // Iniciar seguimiento en tiempo real
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) return;
    
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }

    const id = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000 // 1 minuto
      }
    );

    setWatchId(id);
    setIsTracking(true);
    console.log('🎯 Seguimiento de ubicación iniciado');
  }, [handlePosition, handleError, watchId]);

  // Detener seguimiento
  const stopTracking = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
    console.log('⏹️ Seguimiento de ubicación detenido');
  }, [watchId]);

  // Cargar ubicación offline
  const loadOfflineLocation = useCallback(() => {
    try {
      const savedLocation = localStorage.getItem('userLocation');
      if (savedLocation) {
        const locationData = JSON.parse(savedLocation);
        setLocation(prev => ({
          ...prev,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          timestamp: locationData.timestamp,
          error: null
        }));
        console.log('📂 Ubicación offline cargada:', locationData);
        return locationData;
      }
    } catch (error) {
      console.error('Error cargando ubicación offline:', error);
    }
    return null;
  }, []);

  // Eliminar datos de ubicación
  const handleDeleteLocation = async () => {
    // Usar window.confirm para evitar el warning de ESLint
    if (!window.confirm('¿Estás seguro de que deseas eliminar tus datos de ubicación?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/usuarios/ubicacion`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Limpiar datos locales
        localStorage.removeItem('userLocation');
        localStorage.removeItem('offlineLocationQueue');
        
        // Resetear estado
        setLocation({
          latitude: null,
          longitude: null,
          accuracy: null,
          timestamp: null,
          error: null,
          loading: false,
          permission: 'prompt'
        });
        
        alert('Datos de ubicación eliminados correctamente');
      } else {
        alert('Error eliminando datos de ubicación');
      }
    } catch (error) {
      console.error('Error eliminando ubicación:', error);
      alert('Error eliminando datos de ubicación');
    }
  };

  // Obtener usuarios cercanos (solo admins)
  const fetchNearbyUsers = async () => {
    if (!location.latitude || !location.longitude || user?.rol !== 'admin') return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/usuarios/cercanos?latitude=${location.latitude}&longitude=${location.longitude}&radius=5000`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNearbyUsers(data.data || []);
        setShowNearby(true);
      }
    } catch (error) {
      console.error('Error obteniendo usuarios cercanos:', error);
    }
  };

  // Cargar información del usuario
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setUser(data))
        .catch(err => console.error('Error cargando usuario:', err));
    }
  }, [API_URL]);

  // Cargar ubicación offline al montar
  useEffect(() => {
    loadOfflineLocation();
  }, [loadOfflineLocation]);

  // Sincronizar cuando vuelve la conexión
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🌐 Conexión restaurada, sincronizando...');
      
      try {
        const offlineQueue = JSON.parse(localStorage.getItem('offlineLocationQueue') || '[]');
        if (offlineQueue.length === 0) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        for (const locationData of offlineQueue) {
          await fetch(`${API_URL}/usuarios/ubicacion`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
              timestamp: locationData.timestamp
            })
          });
        }

        // Limpiar cola después de sincronización
        localStorage.removeItem('offlineLocationQueue');
        console.log('✅ Sincronización completada');
      } catch (error) {
        console.error('Error en sincronización:', error);
      }
    };

    const handleOffline = () => {
      console.log('📱 Conexión perdida, modo offline activado');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [API_URL]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Formatear coordenadas
  const formatLocation = (lat, lng) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // Formatear distancia
  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>🌍 Gestión de Ubicación</h1>
      
      {/* Estado de conexión */}
      <div style={{ 
        padding: '10px', 
        marginBottom: '20px', 
        borderRadius: '5px', 
        backgroundColor: navigator.onLine ? '#e8f5e8' : '#fff3cd',
        border: `1px solid ${navigator.onLine ? '#4caf50' : '#ffc107'}`
      }}>
        <strong>Estado: </strong>
        {navigator.onLine ? '🌐 Online' : '📱 Offline'}
        {!navigator.onLine && ' - Los datos se guardarán localmente'}
      </div>

      {/* Tarjeta principal */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px', 
        marginBottom: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2>📍 Mi Ubicación Actual</h2>
        
        {location.loading && (
          <div style={{ padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px', marginBottom: '15px' }}>
            🔄 Obteniendo ubicación...
          </div>
        )}

        {location.error && (
          <div style={{ padding: '10px', backgroundColor: '#ffebee', borderRadius: '5px', marginBottom: '15px', color: '#d32f2f' }}>
            ❌ {location.error}
          </div>
        )}

        {location.latitude && location.longitude ? (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontFamily: 'monospace', 
              fontSize: '16px', 
              padding: '10px', 
              backgroundColor: '#e8f5e8', 
              borderRadius: '5px',
              marginBottom: '10px'
            }}>
              📍 {formatLocation(location.latitude, location.longitude)}
            </div>
            
            {location.accuracy && (
              <div style={{ marginBottom: '10px' }}>
                <span style={{ 
                  padding: '4px 8px', 
                  backgroundColor: location.accuracy < 50 ? '#4caf50' : '#ff9800', 
                  color: 'white', 
                  borderRadius: '12px',
                  fontSize: '12px'
                }}>
                  🎯 Precisión: {Math.round(location.accuracy)}m
                </span>
              </div>
            )}
            
            {location.timestamp && (
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                🕒 {new Date(location.timestamp).toLocaleString()}
              </div>
            )}

            <div style={{ fontSize: '14px', color: '#666' }}>
              {isTracking ? '🔴 Seguimiento activo' : '⚫ Ubicación estática'}
            </div>
          </div>
        ) : (
          <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px', marginBottom: '20px' }}>
            ℹ️ No se ha obtenido tu ubicación. Haz clic en "Obtener Ubicación" para comenzar.
          </div>
        )}

        {/* Botones de control */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={getCurrentLocation}
            disabled={location.loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: location.loading ? 'not-allowed' : 'pointer',
              opacity: location.loading ? 0.6 : 1
            }}
          >
            🎯 Obtener Ubicación
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox"
              checked={isTracking}
              onChange={(e) => e.target.checked ? startTracking() : stopTracking()}
              disabled={location.loading || !location.latitude}
            />
            📡 Seguimiento en tiempo real
          </label>

          {location.latitude && (
            <button 
              onClick={handleDeleteLocation}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              🗑️ Eliminar Datos
            </button>
          )}
        </div>
      </div>

      {/* Usuarios cercanos (solo para admins) */}
      {user?.rol === 'admin' && location.latitude && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3>👥 Usuarios Cercanos</h3>
            <button 
              onClick={fetchNearbyUsers}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              🔍 Buscar
            </button>
          </div>

          {showNearby && (
            <div>
              {nearbyUsers.length > 0 ? (
                <div>
                  <p style={{ marginBottom: '15px' }}>
                    📍 Encontrados {nearbyUsers.length} usuarios en un radio de 5km:
                  </p>
                  {nearbyUsers.map((nearbyUser) => (
                    <div key={nearbyUser.id} style={{ 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '5px', 
                      marginBottom: '10px',
                      backgroundColor: 'white'
                    }}>
                      <div style={{ fontWeight: 'bold' }}>{nearbyUser.nombre}</div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{nearbyUser.email}</div>
                      <div style={{ fontSize: '12px', marginTop: '5px' }}>
                        <span style={{ 
                          padding: '2px 6px', 
                          backgroundColor: nearbyUser.rol === 'admin' ? '#f44336' : '#2196f3', 
                          color: 'white', 
                          borderRadius: '10px',
                          marginRight: '10px'
                        }}>
                          {nearbyUser.rol}
                        </span>
                        <span style={{ color: '#666' }}>
                          📏 {formatDistance(nearbyUser.distance)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
                  ℹ️ No hay usuarios cercanos en un radio de 5km.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Información técnica */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '5px',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>ℹ️ Información:</strong>
        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li>Los datos se guardan automáticamente en el servidor cuando hay conexión</li>
          <li>Sin conexión, los datos se almacenan localmente y se sincronizan al reconectarse</li>
          <li>El seguimiento en tiempo real actualiza tu ubicación cada minuto</li>
          <li>Solo los administradores pueden ver usuarios cercanos</li>
          <li>Puedes eliminar tus datos de ubicación en cualquier momento</li>
        </ul>
      </div>
    </div>
  );
};

export default LocationManager;