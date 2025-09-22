import React, { useState } from 'react';
import axios from 'axios';
import {
  Box, TextField, Button, Typography, Alert, Paper, Link, Stack,
  Fade, Zoom, InputAdornment, CircularProgress
} from '@mui/material';
import { Email, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setMsg('');
    setIsLoading(true);
    
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setIsLoading(false);
      setMsg('Si el email existe, se enviará un enlace para restablecer la contraseña.');
      setTimeout(() => navigate('/'), 4000);
    } catch (err) {
      setIsLoading(false);
      setError('Error enviando email. Por favor, intenta nuevamente.');
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
              Recuperar Contraseña
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Te enviaremos un enlace para restablecer tu contraseña
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
            {msg && (
              <Zoom in={true}>
                <Alert 
                  severity="success" 
                  sx={{ 
                    borderRadius: 2,
                    alignItems: 'center'
                  }}
                >
                  {msg}
                </Alert>
              </Zoom>
            )}
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
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
              {isLoading ? <CircularProgress size={24} /> : 'Enviar enlace'}
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
                Volver al inicio de sesión
              </Link>
            </Stack>
          </form>
        </Paper>
      </Fade>
    </Box>
  );
};

export default ForgotPassword;