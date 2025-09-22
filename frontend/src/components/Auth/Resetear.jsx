import React, { useState } from 'react';
import axios from 'axios';
import {
  Box, TextField, Button, Typography, Alert, Paper, Link, Stack
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token, password });
      setMsg('Contraseña actualizada correctamente. Ahora puedes iniciar sesión.');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error actualizando contraseña.');
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Paper elevation={6} sx={{ p: 4, width: 400, maxWidth: '90%' }}>
        <Typography variant="h4" align="center" mb={2} fontWeight={700} color="primary">
          Restablecer Contraseña
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField
            label="Nueva Contraseña"
            type="password"
            fullWidth
            margin="normal"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
            Cambiar contraseña
          </Button>
          <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
            <Link href="/" underline="hover" color="secondary">
              Volver al login
            </Link>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
};

export default ResetPassword;