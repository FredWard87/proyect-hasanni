import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Paper,
  AppBar,
  Toolbar,
  Chip,
  Avatar,
  IconButton,
  Alert,
  CircularProgress,
  Backdrop,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  MyLocation as MyLocationIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  LocationOn as LocationOnIcon,
  Store as StoreIcon,
  Settings as SettingsIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  GpsFixed as GpsFixedIcon,
  GpsNotFixed as GpsNotFixedIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Componente de campanita de notificaciones simplificado
const NotificationBell = () => {
  const [unreadCount] = useState(0); // En una implementación real, esto vendría de un hook

  return (
    <IconButton color="inherit">
      <Box sx={{ position: 'relative' }}>
        <NotificationsIcon />
        {unreadCount > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              backgroundColor: 'red',
              color: 'white',
              borderRadius: '50%',
              width: 20,
              height: 20,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {unreadCount}
          </Box>
        )}
      </Box>
    </IconButton>
  );
};

// Función para obtener iniciales del nombre
const getInitials = (nombre) => {
  if (!nombre) return 'U';
  return nombre
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();

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

      return response.ok;
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

    saveLocationOffline(coords);

    if (navigator.onLine) {
      await saveLocationOnline(coords);
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
        maximumAge: 300000
      }
    );
  }, [handlePosition, handleError]);

  // Iniciar/detener seguimiento
  const toggleTracking = useCallback(() => {
    if (isTracking) {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setIsTracking(false);
    } else {
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
          maximumAge: 60000
        }
      );

      setWatchId(id);
      setIsTracking(true);
    }
  }, [isTracking, watchId, handlePosition, handleError]);

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
        return locationData;
      }
    } catch (error) {
      console.error('Error cargando ubicación offline:', error);
    }
    return null;
  }, []);

  // Eliminar datos de ubicación
  const handleDeleteLocation = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar tus datos de ubicación?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/usuarios/ubicacion`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      localStorage.removeItem('userLocation');
      localStorage.removeItem('offlineLocationQueue');
      
      setLocation({
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: null,
        error: null,
        loading: false,
        permission: 'prompt'
      });
    } catch (error) {
      console.error('Error eliminando ubicación:', error);
    }
  };

  // Obtener usuarios cercanos
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

  // Manejar cambios de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Función para cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  // Función para verificar si es admin
  const esAdministrador = () => {
    return user && user.rol === 'admin';
  };

  // Función para navegar a pagos
  const irAPagos = () => {
    navigate('/admin/pagos');
  };

  // Formatear coordenadas
  const formatLocation = (lat, lng) => {
    return `${lat?.toFixed(6) || 'N/A'}, ${lng?.toFixed(6) || 'N/A'}`;
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* BARRA SUPERIOR */}
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Gestión de Ubicación
          </Typography>
          
          <NotificationBell />
          
          {user && (
            <>
              <Chip
                label={`${user.nombre} (${user.rol})`}
                color={user.rol === 'admin' ? 'error' : user.rol === 'editor' ? 'warning' : 'success'}
                sx={{ mr: 2 }}
                avatar={
                  <Avatar sx={{ 
                    bgcolor: user.rol === 'admin' ? 'error.main' : 
                             user.rol === 'editor' ? 'warning.main' : 'success.main'
                  }}>
                    {getInitials(user.nombre)}
                  </Avatar>
                }
              />
              <Button
                variant="outlined"
                startIcon={<StoreIcon />}
                onClick={() => navigate('/Usuarios')}
                sx={{ mr: 1, color: 'white', borderColor: 'white' }}
              >
                home
              </Button>

              <Button
                variant="outlined"
                startIcon={<StoreIcon />}
                onClick={() => navigate('/shop')}
                sx={{ mr: 1, color: 'white', borderColor: 'white' }}
              >
                Tienda
              </Button>

              <Button
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => navigate('/preferentuser')}
                sx={{ mr: 1, color: 'white', borderColor: 'white' }}
              >
                Preferencias
              </Button>

              {esAdministrador() && (
                <Button
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={irAPagos}
                  sx={{ mr: 1 }}
                >
                  Pagos
                </Button>
              )}
              
              <Button
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
              >
                Salir
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* CONTENIDO PRINCIPAL */}
      <Container maxWidth="md" sx={{ mt: 4 }}>
        {/* Estado de conexión */}
        <Alert 
          severity={isOnline ? "success" : "warning"} 
          icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
          sx={{ mb: 3 }}
        >
          {isOnline ? 'Conectado - Modo online' : 'Sin conexión - Modo offline'}
        </Alert>

        {/* Tarjeta principal de ubicación */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <MyLocationIcon sx={{ mr: 1 }} />
              Mi Ubicación Actual
            </Typography>

            {location.loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CircularProgress size={20} sx={{ mr: 2 }} />
                <Typography>Obteniendo ubicación...</Typography>
              </Box>
            )}

            {location.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {location.error}
              </Alert>
            )}

            {location.latitude && location.longitude ? (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" color="primary" sx={{ fontFamily: 'monospace', mb: 1 }}>
                  📍 {formatLocation(location.latitude, location.longitude)}
                </Typography>
                
                {location.accuracy && (
                  <Chip 
                    label={`Precisión: ${Math.round(location.accuracy)}m`}
                    color={location.accuracy < 50 ? "success" : "warning"}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                  />
                )}
                
                {location.timestamp && (
                  <Typography variant="body2" color="text.secondary">
                    🕒 {new Date(location.timestamp).toLocaleString()}
                  </Typography>
                )}

                <Chip 
                  label={isTracking ? 'Seguimiento activo' : 'Ubicación estática'}
                  icon={isTracking ? <GpsFixedIcon /> : <GpsNotFixedIcon />}
                  color={isTracking ? "success" : "default"}
                  sx={{ mt: 1 }}
                />
              </Box>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                No se ha obtenido tu ubicación. Haz clic en "Obtener Ubicación" para comenzar.
              </Alert>
            )}

            {/* Botones de control */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant="contained"
                startIcon={<MyLocationIcon />}
                onClick={getCurrentLocation}
                disabled={location.loading}
              >
                Obtener Ubicación
              </Button>

              <FormControlLabel
                control={
                  <Switch
                    checked={isTracking}
                    onChange={toggleTracking}
                    disabled={location.loading || !location.latitude}
                  />
                }
                label="Seguimiento en tiempo real"
              />

              {location.latitude && (
                <Button
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteLocation}
                  color="error"
                >
                  Eliminar Datos
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Usuarios cercanos (solo para admins) */}
        {user?.rol === 'admin' && location.latitude && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  👥 Usuarios Cercanos
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={fetchNearbyUsers}
                >
                  Buscar
                </Button>
              </Box>

              {showNearby && (
                <Box>
                  {nearbyUsers.length > 0 ? (
                    <List>
                      {nearbyUsers.map((nearbyUser) => (
                        <ListItem key={nearbyUser.id} divider>
                          <ListItemIcon>
                            <PersonIcon color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={nearbyUser.nombre}
                            secondary={
                              <Box>
                                <Typography variant="body2">{nearbyUser.email}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                  <Chip 
                                    label={nearbyUser.rol}
                                    size="small"
                                    color={nearbyUser.rol === 'admin' ? "error" : "primary"}
                                  />
                                  <Typography variant="caption">
                                    📏 {Math.round(nearbyUser.distance)}m de distancia
                                  </Typography>
                                </Box>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Alert severity="info">
                      No hay usuarios cercanos en un radio de 5km.
                    </Alert>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Container>
    </Box>
  );
};

export default LocationManager;