import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const useGeolocation = () => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    error: null,
    loading: false,
    permission: 'prompt' // 'granted', 'denied', 'prompt'
  });

  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);

  // Guardar ubicación en localStorage como respaldo offline
  const saveLocationOffline = useCallback((coords) => {
    const locationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp: new Date().toISOString(),
      offline: true
    };
    
    try {
      // Guardar ubicación actual
      localStorage.setItem('userLocation', JSON.stringify(locationData));
      
      // Guardar en cola de sincronización offline
      const offlineQueue = JSON.parse(localStorage.getItem('offlineLocationQueue') || '[]');
      offlineQueue.push(locationData);
      localStorage.setItem('offlineLocationQueue', JSON.stringify(offlineQueue));
      
      console.log('Ubicación guardada offline:', locationData);
    } catch (error) {
      console.error('Error guardando ubicación offline:', error);
    }
  }, []);

  // Enviar ubicación al servidor
  const saveLocationOnline = useCallback(async (coords) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const locationData = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy
      };

      await axios.post(`${API_URL}/usuarios/ubicacion`, locationData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Ubicación guardada en servidor:', locationData);
      return true;
    } catch (error) {
      console.error('Error guardando ubicación online:', error);
      return false;
    }
  }, []);

  // Sincronizar ubicaciones offline cuando hay conexión
  const syncOfflineLocations = useCallback(async () => {
    try {
      const offlineQueue = JSON.parse(localStorage.getItem('offlineLocationQueue') || '[]');
      if (offlineQueue.length === 0) return;

      const token = localStorage.getItem('token');
      if (!token) return;

      console.log(`Sincronizando ${offlineQueue.length} ubicaciones offline...`);

      for (const locationData of offlineQueue) {
        try {
          await axios.post(`${API_URL}/usuarios/ubicacion`, {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            timestamp: locationData.timestamp
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          console.error('Error sincronizando ubicación:', error);
          break; // Si falla una, no continúes
        }
      }

      // Limpiar cola después de sincronización exitosa
      localStorage.removeItem('offlineLocationQueue');
      console.log('Sincronización offline completada');
    } catch (error) {
      console.error('Error en sincronización offline:', error);
    }
  }, []);

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
      loading: false
    }));

    // Guardar offline siempre como respaldo
    saveLocationOffline(coords);

    // Intentar guardar online
    if (navigator.onLine) {
      const saved = await saveLocationOnline(coords);
      if (!saved) {
        console.log('Error guardando online, ubicación disponible offline');
      }
    } else {
      console.log('Sin conexión, ubicación guardada offline');
    }
  }, [saveLocationOffline, saveLocationOnline]);

  // Manejar errores de geolocalización
  const handleError = useCallback((error) => {
    let errorMessage = '';
    let permission = 'denied';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permisos de ubicación denegados';
        permission = 'denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Ubicación no disponible';
        permission = 'granted'; // Permisos ok, pero sin señal
        break;
      case error.TIMEOUT:
        errorMessage = 'Tiempo de espera agotado';
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

    console.error('Error de geolocalización:', errorMessage);
  }, []);

  // Solicitar ubicación una vez
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
  }, [handlePosition, handleError, watchId]);

  // Detener seguimiento
  const stopTracking = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  }, [watchId]);

  // Cargar ubicación guardada offline
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
        console.log('Ubicación offline cargada:', locationData);
        return locationData;
      }
    } catch (error) {
      console.error('Error cargando ubicación offline:', error);
    }
    return null;
  }, []);

  // Verificar permisos de ubicación
  const checkPermissions = useCallback(async () => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setLocation(prev => ({ ...prev, permission: result.state }));
        return result.state;
      } catch (error) {
        console.error('Error verificando permisos:', error);
      }
    }
    return 'prompt';
  }, []);

  // Efecto para manejar conexión online/offline
  useEffect(() => {
    const handleOnline = () => {
      console.log('Conexión restaurada, sincronizando ubicaciones...');
      syncOfflineLocations();
    };

    const handleOffline = () => {
      console.log('Conexión perdida, modo offline activado');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineLocations]);

  // Inicialización
  useEffect(() => {
    checkPermissions();
    loadOfflineLocation();
    
    // Sincronizar ubicaciones offline pendientes si hay conexión
    if (navigator.onLine) {
      syncOfflineLocations();
    }
  }, [checkPermissions, loadOfflineLocation, syncOfflineLocations]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    location,
    isTracking,
    getCurrentLocation,
    startTracking,
    stopTracking,
    loadOfflineLocation,
    syncOfflineLocations,
    checkPermissions
  };
};