import React, { useState } from 'react';
import axios from 'axios';
import {
  Box, TextField, Button, Typography, Alert, Paper, Link, Stack,
  Fade, Zoom, InputAdornment, CircularProgress
} from '@mui/material';
import { 
  Email, Person, Lock, Visibility, VisibilityOff, ArrowBack 
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Register = () => {
  const [form, setForm] = useState({ 
    nombre: '', 
    email: '', 
    password: '', 
    rol: 'lector' // Rol siempre establecido como 'lector' por defecto
  });
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
      // El formulario siempre enviará rol: 'lector'
      await axios.post(`${API_URL}/auth/register`, form);
      setIsLoading(false);
      setSuccess('Usuario registrado correctamente. Ahora puedes iniciar sesión.');
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setIsLoading(false);
      setError(err.response?.data?.message || 'Error en el registro. Por favor, intenta nuevamente.');
    }
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
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
          width: 450,
          maxWidth: '90%',
          borderRadius: 3,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Título y descripción */}
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
              Crear Cuenta
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completa tus datos para registrarte
            </Typography>
          </Box>

          {/* Alertas */}
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

          <form onSubmit={handleSubmit}>
            <TextField
              label="Nombre completo"
              fullWidth
              margin="normal"
              required
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" />
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
                    <Button
                      aria-label="toggle password visibility"
                      onClick={handleClickShowPassword}
                      sx={{ minWidth: 'auto', p: 1 }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }}
            />
            
            {/* Campo de rol oculto pero con valor fijo 'lector' */}
            <input type="hidden" name="rol" value="lector" />
            
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
              {isLoading ? <CircularProgress size={24} /> : 'Registrarse'}
            </Button>
            
            <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
              <Link 
                href="/" 
                underline="hover" 
                color="primary"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontWeight: 500
                }}
              >
                <ArrowBack sx={{ fontSize: 18, mr: 0.5 }} />
                ¿Ya tienes cuenta? Inicia sesión
              </Link>
            </Stack>
          </form>
        </Paper>
      </Fade>
    </Box>
  );
};

export default Register;