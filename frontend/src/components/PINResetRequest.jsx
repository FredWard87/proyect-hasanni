import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Typography, Button, Alert, TextField,
    CircularProgress, InputAdornment
} from '@mui/material';
import { Email, Security, Send } from '@mui/icons-material';

const PINResetRequest = ({ open, onClose, onCodeSent }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!email) {
            setError('Por favor ingresa tu email');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Por favor ingresa un email válido');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/biometric/request-pin-reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(`Código enviado a ${data.email}`);
                setTimeout(() => {
                    onCodeSent && onCodeSent(email);
                    onClose && onClose();
                }, 2000);
            } else {
                setError(data.message);
            }

        } catch (error) {
            console.error('Error solicitando restablecimiento:', error);
            setError('Error de conexión. Verifica tu internet.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 3 }
            }}
        >
            <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    <Security color="primary" sx={{ fontSize: 40 }} />
                </Box>
                <Typography variant="h5" component="div">
                    Restablecer PIN
                </Typography>
            </DialogTitle>

            <DialogContent>
                <Typography variant="body1" gutterBottom align="center" color="text.secondary">
                    Ingresa tu email para recibir un código de verificación
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {success}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Email />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ mb: 3 }}
                        autoFocus
                    />

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Te enviaremos un código de verificación de 6 dígitos que expira en 15 minutos.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <Button
                            variant="outlined"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={loading || !email}
                            startIcon={loading ? <CircularProgress size={16} /> : <Send />}
                        >
                            {loading ? 'Enviando...' : 'Enviar Código'}
                        </Button>
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default PINResetRequest;