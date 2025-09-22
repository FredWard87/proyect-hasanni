import React, { useState } from 'react';
import axios from 'axios';
import {
  Box, TextField, Button, Typography, Alert, Link, Paper, Stack,
  Fade, Zoom, InputAdornment, IconButton, Divider, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip
} from '@mui/material';
import {
  Google, Visibility, VisibilityOff, Email, Lock,
  Security, ArrowBack, LocationOn, LocationOff
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para geolocalización
  const [locationDialog, setLocationDialog] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle, requesting, success, denied
  const [savedToken, setSavedToken] = useState(null);
  
  const navigate = useNavigate();

  // Función para solicitar ubicación
  const requestLocation = async (token) => {
    setLocationStatus('requesting');
    
    if (!navigator.geolocation) {
      console.log('Geolocalización no soportada');
      setLocationStatus('denied');
      // Continuar sin ubicación
      setTimeout(() => navigate('/Usuarios'), 1500);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Enviar ubicación al servidor
          await axios.post(`${API_URL}/usuarios/ubicacion`, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });

          // Guardar también en localStorage como respaldo
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('userLocation', JSON.stringify(locationData));
          
          setLocationStatus('success');
          setSuccess('Ubicación guardada correctamente');
          
          setTimeout(() => {
            setLocationDialog(false);
            navigate('/Usuarios');
          }, 1500);
          
        } catch (error) {
          console.error('Error guardando ubicación:', error);
          // Guardar solo offline si falla el servidor
          try {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: new Date().toISOString(),
              offline: true
            };
            localStorage.setItem('userLocation', JSON.stringify(locationData));
            
            // Agregar a cola de sincronización
            const offlineQueue = JSON.parse(localStorage.getItem('offlineLocationQueue') || '[]');
            offlineQueue.push(locationData);
            localStorage.setItem('offlineLocationQueue', JSON.stringify(offlineQueue));
            
            setLocationStatus('success');
            setSuccess('Ubicación guardada offline');
          } catch (offlineError) {
            console.error('Error guardando ubicación offline:', offlineError);
            setLocationStatus('denied');
          }
          
          setTimeout(() => {
            setLocationDialog(false);
            navigate('/Usuarios');
          }, 1500);
        }
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
        let errorMessage = '';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permisos de ubicación denegados';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Ubicación no disponible';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo agotado obteniendo ubicación';
            break;
          default:
            errorMessage = 'Error desconocido';
            break;
        }
        
        setLocationStatus('denied');
        setError(`Error de ubicación: ${errorMessage}`);
        
        // Continuar sin ubicación después de 2 segundos
        setTimeout(() => {
          setLocationDialog(false);
          navigate('/Usuarios');
        }, 2000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutos
      }
    );
  };

  // Función para omitir ubicación
  const skipLocation = () => {
    setLocationDialog(false);
    navigate('/Usuarios');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${API_URL}/auth/login`, form);
      setIsLoading(false);
      
      if (res.data.require2fa) {
        setUserId(res.data.userId);
        setStep(2);
        setSuccess('Código de verificación enviado a tu correo electrónico');
      } else {
        localStorage.setItem('token', res.data.token);
        setSavedToken(res.data.token);
        setSuccess('¡Inicio de sesión exitoso!');
        
        // Mostrar dialog de ubicación después de login exitoso
        setTimeout(() => {
          setLocationDialog(true);
        }, 1000);
      }
    } catch (err) {
      setIsLoading(false);
      setError(err.response?.data?.message || 'Error de autenticación. Verifica tus credenciales.');
    }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${API_URL}/auth/2fa/verify`, { userId, otp });
      setIsLoading(false);
      localStorage.setItem('token', res.data.token);
      setSavedToken(res.data.token);
      setSuccess('¡Verificación exitosa!');
      
      // Mostrar dialog de ubicación después de 2FA exitoso
      setTimeout(() => {
        setLocationDialog(true);
      }, 1000);
      
    } catch (err) {
      setIsLoading(false);
      setError(err.response?.data?.message || 'Código incorrecto. Intenta nuevamente.');
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToLogin = () => {
    setStep(1);
    setError(null);
    setSuccess(null);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2
    }}>
      <Fade in={true} timeout={800}>
        <Paper elevation={10} sx={{
          p: 4,
          width: 400,
          maxWidth: '90%',
          borderRadius: 3,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Logo o título principal */}
          <Box textAlign="center" mb={3}>
            <Typography 
              variant="h4" 
              fontWeight={700} 
              color="primary"
              gutterBottom
              sx={{ 
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Bienvenido
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {step === 1 ? 'Ingresa a tu cuenta' : 'Verificación de seguridad'}
            </Typography>
          </Box>

          {/* Alertas de éxito y error */}
          <Box mb={2}>
            {error && (
              <Zoom in={true}>
                <Alert 
                  severity="error" 
                  sx={{ 
                    borderRadius: 2,
                    alignItems: 'center'
                  }}
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              </Zoom>
            )}
            {success && (
              <Zoom in={true}>
                <Alert 
                  severity="success" 
                  sx={{ 
                    borderRadius: 2,
                    alignItems: 'center'
                  }}
                >
                  {success}
                </Alert>
              </Zoom>
            )}
          </Box>

          {step === 1 ? (
            <Fade in={step === 1} timeout={500}>
              <form onSubmit={handleLogin}>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  margin="normal"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                />
                <TextField
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                />
                <Button 
                  type="submit" 
                  variant="contained" 
                  color="primary" 
                  fullWidth 
                  sx={{ 
                    mt: 3, 
                    mb: 2, 
                    py: 1.5,
                    borderRadius: 2,
                    fontSize: '1rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(0, 116, 240, 0.4)'
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Ingresar'}
                </Button>
                
                <Divider sx={{ my: 2 }}>
                  <Typography variant="body2" color="text.secondary">o</Typography>
                </Divider>
                
                <Button
                  variant="outlined"
                  color="inherit"
                  fullWidth
                  startIcon={<Google />}
                  sx={{ 
                    mb: 2, 
                    py: 1.5,
                    borderRadius: 2,
                    fontWeight: 600,
                    borderColor: '#ddd',
                    color: 'text.primary',
                    '&:hover': {
                      borderColor: '#ccc',
                      backgroundColor: 'rgba(0, 0, 0, 0.04)'
                    }
                  }}
                  onClick={handleGoogleLogin}
                >
                  Continuar con Google
                </Button>
                
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
                  <Link 
                    href="/forgot-password" 
                    underline="hover" 
                    color="secondary"
                    sx={{ fontSize: '0.9rem' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                  <Link 
                    href="/register" 
                    underline="hover" 
                    color="primary"
                    sx={{ fontSize: '0.9rem', fontWeight: 500 }}
                  >
                    Crear una cuenta
                  </Link>
                </Stack>
              </form>
            </Fade>
          ) : (
            <Fade in={step === 2} timeout={500}>
              <form onSubmit={handle2FA}>
                <Box textAlign="center" mb={2}>
                  <Security sx={{ fontSize: 50, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Verificación en dos pasos
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Hemos enviado un código de verificación a tu correo electrónico.
                  </Typography>
                </Box>
                
                <TextField
                  label="Código de verificación"
                  fullWidth
                  margin="normal"
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Security color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                />
                
                <Button 
                  type="submit" 
                  variant="contained" 
                  color="primary" 
                  fullWidth 
                  sx={{ 
                    mt: 2, 
                    mb: 1,
                    py: 1.5,
                    borderRadius: 2,
                    fontSize: '1rem',
                    fontWeight: 600
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Verificar Código'}
                </Button>
                
                <Button
                  fullWidth
                  startIcon={<ArrowBack />}
                  sx={{ 
                    mt: 1,
                    borderRadius: 2,
                  }}
                  onClick={handleBackToLogin}
                >
                  Volver al inicio de sesión
                </Button>
              </form>
            </Fade>
          )}
        </Paper>
      </Fade>

      {/* Dialog de Ubicación */}
      <Dialog 
        open={locationDialog} 
        onClose={() => {}}
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <LocationOn sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Permitir Ubicación
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
          <Typography variant="body1" gutterBottom>
            Para brindarte una mejor experiencia, nos gustaría acceder a tu ubicación.
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Esto nos permitirá:
          </Typography>
          
          <Box sx={{ textAlign: 'left', mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Mostrar contenido relevante a tu zona
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Encontrar usuarios o servicios cercanos
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Funcionar sin conexión (datos guardados localmente)
            </Typography>
          </Box>

          {locationStatus === 'requesting' && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <CircularProgress size={24} />
              <Typography>Obteniendo ubicación...</Typography>
            </Box>
          )}

          {locationStatus === 'success' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ¡Ubicación guardada correctamente!
            </Alert>
          )}

          {locationStatus === 'denied' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No se pudo obtener la ubicación. Puedes continuar sin ella.
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary">
            Puedes cambiar estos permisos más tarde en la configuración de tu navegador.
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ justifyContent: 'center', gap: 1, pb: 3 }}>
          <Button 
            onClick={skipLocation}
            variant="outlined"
            sx={{ borderRadius: 2 }}
            disabled={locationStatus === 'requesting'}
          >
            Omitir
          </Button>
          <Button 
            onClick={() => requestLocation(savedToken)}
            variant="contained"
            startIcon={locationStatus === 'requesting' ? <CircularProgress size={16} /> : <LocationOn />}
            sx={{ borderRadius: 2 }}
            disabled={locationStatus === 'requesting' || locationStatus === 'success'}
          >
            {locationStatus === 'requesting' ? 'Obteniendo...' : 'Permitir Ubicación'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Login;