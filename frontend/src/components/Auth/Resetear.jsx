import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import { 
  Lock as LockIcon, 
  Check as CheckIcon, 
  Warning as WarningIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);

  // Verificar token al cargar
  useEffect(() => {
    if (token) {
      try {
        // Decodificar el token para obtener información
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setTokenInfo({
          userId: decoded.userId,
          type: decoded.type,
          timestamp: new Date(decoded.timestamp),
          expires: new Date(decoded.exp * 1000),
          adminRequest: decoded.adminRequest || false
        });
        
        console.log('🔐 INFORMACIÓN DEL TOKEN:');
        console.log(`👤 User ID: ${decoded.userId}`);
        console.log(`📝 Tipo: ${decoded.type}`);
        console.log(`🕒 Emitido: ${new Date(decoded.timestamp).toLocaleString()}`);
        console.log(`⏰ Expira: ${new Date(decoded.exp * 1000).toLocaleString()}`);
        console.log(`👑 Admin: ${decoded.adminRequest ? 'SÍ' : 'NO'}`);
        
      } catch (error) {
        setError('Token inválido o malformado');
        console.error('❌ Error decodificando token:', error);
      }
    } else {
      setError('No se proporcionó token de restablecimiento');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!token) {
      setError('Token de restablecimiento no válido');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        token: token,
        password: formData.password
      });

      if (response.data.success) {
        setSuccess('Contraseña restablecida exitosamente');
        console.log('✅ Contraseña cambiada exitosamente');
        
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Error al restablecer contraseña';
      setError(errorMsg);
      console.error('❌ Error restableciendo contraseña:', err);
    } finally {
      setLoading(false);
    }
  };

  const isTokenExpired = () => {
    if (!tokenInfo) return false;
    return new Date() > tokenInfo.expires;
  };

  const getTimeRemaining = () => {
    if (!tokenInfo) return 'N/A';
    const now = new Date();
    const diff = tokenInfo.expires - now;
    const minutes = Math.floor(diff / 60000);
    return minutes > 0 ? `${minutes} minutos` : 'Expirado';
  };

  if (!token) {
    return (
      <Container component="main" maxWidth="sm">
        <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Alert severity="error" sx={{ width: '100%' }}>
            No se proporcionó token de restablecimiento
          </Alert>
          <Button 
            variant="contained" 
            sx={{ mt: 2 }}
            onClick={() => navigate('/')}
          >
            Volver al inicio
          </Button>
        </Box>
      </Container>
    );
  }

  if (isTokenExpired()) {
    return (
      <Container component="main" maxWidth="sm">
        <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Alert severity="warning" sx={{ width: '100%' }}>
            El token de restablecimiento ha expirado
          </Alert>
          <Button 
            variant="contained" 
            sx={{ mt: 2 }}
            onClick={() => navigate('/forgot-password')}
          >
            Solicitar nuevo enlace
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Card elevation={3} sx={{ width: '100%', p: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <LockIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography component="h1" variant="h5" gutterBottom>
                Restablecer Contraseña
              </Typography>
              
              {tokenInfo && (
                <Paper elevation={1} sx={{ p: 2, mt: 1, width: '100%', bgcolor: 'grey.50' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Información del token:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      icon={<WarningIcon />} 
                      label={`Expira en: ${getTimeRemaining()}`} 
                      size="small" 
                      color={getTimeRemaining().includes('Expirado') ? 'error' : 'warning'}
                    />
                    {tokenInfo.adminRequest && (
                      <Chip label="Solicitado por admin" size="small" color="info" />
                    )}
                  </Box>
                </Paper>
              )}
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Nueva Contraseña"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={loading}
                helperText="Mínimo 6 caracteres"
              />
              
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirmar Contraseña"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                disabled={loading}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || isTokenExpired()}
                startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
              >
                {loading ? 'Restableciendo...' : 'Restablecer Contraseña'}
              </Button>
            </form>

            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                ¿Problemas con el restablecimiento?
              </Typography>
              <Button 
                variant="text" 
                size="small"
                onClick={() => navigate('/forgot-password')}
              >
                Solicitar nuevo enlace
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default ResetPassword;