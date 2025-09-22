import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, TextField, Button, Typography, Alert, Link, Paper, Stack,
  Fade, Zoom, InputAdornment, IconButton, Divider, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, Backdrop
} from '@mui/material';
import {
  Google, Visibility, VisibilityOff, Email, Lock,
  Security, ArrowBack, LocationOn, LocationOff,
  Fingerprint, Security as SecurityIcon, WifiOff, Wifi
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// IMPORTAR COMPONENTES BIOMÉTRICOS
import PINSetup from '../PINSetup';
import PINVerify from '../PINVerify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [step, setStep] = useState(1); // 1: Login, 2: 2FA
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState('online'); // 'online' o 'offline'
  const [offlineCode, setOfflineCode] = useState('');
  
  // Estados para geolocalización
  const [locationDialog, setLocationDialog] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [savedToken, setSavedToken] = useState(null);
  
  // Estados para sistema biométrico
  const [showPINSetup, setShowPINSetup] = useState(false);
  const [showPINVerify, setShowPINVerify] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState(null);
  const [requiresBiometric, setRequiresBiometric] = useState(false);
  
  const navigate = useNavigate();

  // Verificar estado biométrico después del login
  const checkBiometricStatus = async (token) => {
    try {
      const response = await fetch(`${API_URL}/biometric/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setBiometricStatus(data);
        
        if (data.requiresSetup) {
          setShowPINSetup(true);
          setRequiresBiometric(true);
        } else if (data.biometricEnabled) {
          setShowPINVerify(true);
          setRequiresBiometric(true);
        } else {
          setLocationDialog(true);
        }
      } else {
        setLocationDialog(true);
      }
    } catch (error) {
      console.error('Error verificando estado biométrico:', error);
      setLocationDialog(true);
    }
  };

  // Función para solicitar ubicación
  const requestLocation = async (token) => {
    setLocationStatus('requesting');
    
    if (!navigator.geolocation) {
      console.log('Geolocalización no soportada');
      setLocationStatus('denied');
      setTimeout(() => navigate('/Usuarios'), 1500);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await axios.post(`${API_URL}/usuarios/ubicacion`, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });

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
          try {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: new Date().toISOString(),
              offline: true
            };
            localStorage.setItem('userLocation', JSON.stringify(locationData));
            
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
        
        setTimeout(() => {
          setLocationDialog(false);
          navigate('/Usuarios');
        }, 2000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  // Función para omitir ubicación
  const skipLocation = () => {
    setLocationDialog(false);
    navigate('/Usuarios');
  };

  // Login mejorado con manejo de errores de conexión
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${API_URL}/auth/login`, form);
      setIsLoading(false);
      
      if (res.data.require2fa) {
        setUserId(res.data.userId);
        setAuthMode(res.data.mode);
        setStep(2);
        
        if (res.data.mode === 'offline') {
          setOfflineCode(res.data.offlineCode || '');
          setSuccess(res.data.message);
        } else {
          setSuccess('Código de verificación enviado a tu correo electrónico');
        }
      }
    } catch (err) {
      setIsLoading(false);
      
      // Manejar errores de conexión
      if (err.code === 'NETWORK_ERROR' || !err.response) {
        setError('❌ Sin conexión a internet. El servidor no está disponible.');
      } else {
        setError(err.response?.data?.message || 'Error de autenticación. Verifica tus credenciales.');
      }
    }
  };

  // Verificación OTP mejorada
  const handle2FA = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${API_URL}/auth/2fa/verify`, { userId, otp });
      setIsLoading(false);
      
      localStorage.setItem('token', res.data.token);
      setSavedToken(res.data.token);
      setSuccess(`✅ ${res.data.message}`);
      
      // Verificar requisitos biométricos
      await checkBiometricStatus(res.data.token);
      
    } catch (err) {
      setIsLoading(false);
      
      if (err.code === 'NETWORK_ERROR' || !err.response) {
        setError('❌ Error de conexión. Verifica tu internet e intenta nuevamente.');
      } else {
        setError(err.response?.data?.message || 'Código incorrecto. Intenta nuevamente.');
      }
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
    setAuthMode('online');
    setOfflineCode('');
  };

  // Manejar éxito del setup de PIN
  const handlePINSetupSuccess = () => {
    setShowPINSetup(false);
    setLocationDialog(true);
  };

  // Manejar éxito de verificación de PIN
  const handlePINVerifySuccess = () => {
    setShowPINVerify(false);
    setLocationDialog(true);
  };

  // Manejar cancelación de PIN
  const handlePINCancel = () => {
    if (biometricStatus?.requiresSetup) {
      setError('Debes configurar el PIN de seguridad para continuar');
      setShowPINSetup(true);
    } else {
      setShowPINVerify(false);
      setError('Verificación de seguridad cancelada');
      localStorage.removeItem('token');
    }
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
                  {authMode === 'offline' ? (
                    <WifiOff sx={{ fontSize: 50, color: 'warning.main', mb: 1 }} />
                  ) : (
                    <Security sx={{ fontSize: 50, color: 'primary.main', mb: 1 }} />
                  )}
                  
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {authMode === 'offline' ? '🔴 Modo Offline' : 'Verificación en dos pasos'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {authMode === 'offline' 
                      ? 'Usa el código proporcionado para continuar'
                      : 'Hemos enviado un código de verificación a tu correo electrónico.'}
                  </Typography>
                  
                  {authMode === 'offline' && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        ⚠️ Funcionalidad limitada hasta restaurar conexión
                      </Typography>
                    </Alert>
                  )}
                  
                  {authMode === 'offline' && offlineCode && (
                    <Box sx={{ 
                      bgcolor: 'warning.light', 
                      p: 2, 
                      borderRadius: 2,
                      mb: 2 
                    }}>
                      <Typography variant="h6" color="warning.dark">
                        Código: {offlineCode}
                      </Typography>
                      <Typography variant="caption" color="warning.dark">
                        Expira en 10 minutos
                      </Typography>
                    </Box>
                  )}
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
                        {authMode === 'offline' ? <WifiOff color="action" /> : <Security color="action" />}
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
                  color={authMode === 'offline' ? 'warning' : 'primary'} 
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
        onClose={skipLocation}
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

      {/* Dialog de Setup de PIN */}
      <PINSetup
        open={showPINSetup}
        onClose={() => setShowPINSetup(false)}
        onSuccess={handlePINSetupSuccess}
        requiresSetup={biometricStatus?.requiresSetup || false}
      />

      {/* Dialog de Verificación de PIN */}
      <PINVerify
        open={showPINVerify}
        onVerify={handlePINVerifySuccess}
        onCancel={handlePINCancel}
      />

      {/* Backdrop global de loading */}
      <Backdrop open={isLoading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </Box>
  );
};

export default Login;