import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Typography, Button, Alert, CircularProgress,
    Paper, Backdrop, Grid
} from '@mui/material';
import { Security, Lock, Fingerprint, Backspace } from '@mui/icons-material';

const PINVerify = ({ open, onVerify, onCancel }) => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [attemptsLeft, setAttemptsLeft] = useState(5);
    const [lockedUntil, setLockedUntil] = useState(null);

    useEffect(() => {
        if (open) {
            setPin('');
            setError('');
            setAttemptsLeft(5);
            setLockedUntil(null);
        }
    }, [open]);

    const handleNumberClick = (number) => {
        if (pin.length < 4) {
            const newPin = pin + number;
            setPin(newPin);
            setError('');

            if (newPin.length === 4) {
                handleVerify(newPin);
            }
        }
    };

    const handleBackspace = () => {
        if (pin.length > 0) {
            setPin(pin.slice(0, -1));
            setError('');
        }
    };

    const handleVerify = async (pinToVerify = null) => {
        const pinFinal = pinToVerify || pin;
        
        if (pinFinal.length !== 4) {
            setError('El PIN debe tener 4 dígitos');
            return;
        }

        console.log('🔢 PIN a verificar:', pinFinal, 'Longitud:', pinFinal.length);
        
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/biometric/verify-pin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ pin: pinFinal })
            });

            const data = await response.json();
            console.log('📡 Respuesta del servidor:', data);

            if (data.success) {
                localStorage.setItem('biometricToken', data.biometricToken);
                onVerify && onVerify(data.biometricToken);
            } else {
                if (response.status === 423) {
                    setLockedUntil(data.lockedUntil);
                    setError('Demasiados intentos fallidos. Intenta más tarde.');
                } else {
                    setError(data.message);
                    setAttemptsLeft(data.attemptsLeft || attemptsLeft - 1);
                }
                setPin('');
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            setError('Error de conexión. Verifica tu internet.');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const handleManualVerify = () => {
        if (pin.length === 4) {
            handleVerify();
        } else {
            setError('Completa los 4 dígitos del PIN');
        }
    };

    // FUNCIÓN SEGURA PARA onCancel
    const handleCancel = () => {
        if (typeof onCancel === 'function') {
            onCancel();
        } else {
            console.warn('onCancel no es una función');
            // Fallback: cerrar el diálogo de todas formas
            setPin('');
            setError('');
        }
    };

    const isLocked = lockedUntil && new Date(lockedUntil) > new Date();

    return (
        <Dialog 
            open={open} 
            onClose={handleCancel} // ← Usar la función segura
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
                    Verificación de Seguridad
                </Typography>
            </DialogTitle>

            <DialogContent>
                <Typography variant="body1" gutterBottom align="center">
                    Ingresa tu PIN de 4 dígitos
                </Typography>

                {isLocked ? (
                    <Alert severity="warning" sx={{ my: 2 }}>
                        <Typography variant="body2">
                            Demasiados intentos fallidos. Puedes intentar nuevamente el{' '}
                            {new Date(lockedUntil).toLocaleString()}.
                        </Typography>
                    </Alert>
                ) : (
                    <>
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                            {[1, 2, 3, 4].map((index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        bgcolor: pin.length >= index ? 'primary.main' : 'grey.300',
                                        mx: 1,
                                        transition: 'all 0.3s ease'
                                    }}
                                />
                            ))}
                        </Box>

                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                            {pin.length}/4 dígitos - PIN: {pin.replace(/./g, '•')}
                        </Typography>

                        <Grid container spacing={1} justifyContent="center" sx={{ maxWidth: 300, margin: '0 auto' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                                <Grid item xs={4} key={number}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => handleNumberClick(number.toString())}
                                        disabled={pin.length >= 4 || loading}
                                        sx={{
                                            width: '100%',
                                            height: 60,
                                            fontSize: '1.5rem',
                                            fontWeight: 'bold',
                                            borderRadius: 2
                                        }}
                                    >
                                        {number}
                                    </Button>
                                </Grid>
                            ))}
                            
                            <Grid item xs={4}>
                                <Button
                                    variant="outlined"
                                    onClick={handleBackspace}
                                    disabled={pin.length === 0 || loading}
                                    sx={{
                                        width: '100%',
                                        height: 60,
                                        borderRadius: 2
                                    }}
                                >
                                    <Backspace />
                                </Button>
                            </Grid>
                            <Grid item xs={4}>
                                <Button
                                    variant="outlined"
                                    onClick={() => handleNumberClick('0')}
                                    disabled={pin.length >= 4 || loading}
                                    sx={{
                                        width: '100%',
                                        height: 60,
                                        fontSize: '1.5rem',
                                        fontWeight: 'bold',
                                        borderRadius: 2
                                    }}
                                >
                                    0
                                </Button>
                            </Grid>
                            <Grid item xs={4}>
                                <Button
                                    variant="contained"
                                    onClick={handleManualVerify}
                                    disabled={pin.length !== 4 || loading}
                                    sx={{
                                        width: '100%',
                                        height: 60,
                                        borderRadius: 2
                                    }}
                                >
                                    {loading ? <CircularProgress size={24} /> : 'Verificar'}
                                </Button>
                            </Grid>
                        </Grid>

                        {error && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {error}
                                {attemptsLeft > 0 && attemptsLeft < 5 && (
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                        Intentos restantes: {attemptsLeft}
                                    </Typography>
                                )}
                            </Alert>
                        )}
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                {!isLocked && (
                    <Button 
                        variant="outlined"
                        onClick={handleCancel} // ← Usar la función segura
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                )}
                {isLocked && (
                    <Button onClick={handleCancel}> {/* ← Usar la función segura */}
                        Cerrar
                    </Button>
                )}
            </DialogActions>

            <Backdrop open={loading} sx={{ zIndex: 1300 }}>
                <CircularProgress color="inherit" />
            </Backdrop>
        </Dialog>
    );
};

// Valores por defecto para las props
PINVerify.defaultProps = {
    onCancel: () => console.warn('onCancel no proporcionado'),
    onVerify: () => console.warn('onVerify no proporcionado'),
};

export default PINVerify;