import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Typography, Button, Alert,
    CircularProgress, Stepper, Step, StepLabel,
    Backdrop, Grid
} from '@mui/material';
import { Security, Fingerprint, CheckCircle, Backspace } from '@mui/icons-material';

const PINSetup = ({ open, onClose, onSuccess, requiresSetup = false }) => {
    const [step, setStep] = useState(0);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const steps = ['Crear PIN', 'Confirmar PIN', 'Completado'];

    useEffect(() => {
        if (open) {
            setStep(0);
            setPin('');
            setConfirmPin('');
            setError('');
            setSuccess('');
        }
    }, [open]);

    // FUNCIÓN SEGURA PARA onClose
    const handleCloseSafe = () => {
        if (typeof onClose === 'function') {
            onClose();
        } else {
            console.warn('onClose no es una función, cerrando dialog');
            // Si requiresSetup es true, no debería permitirse cerrar
            if (!requiresSetup) {
                // Aquí podrías redirigir o hacer otra acción por defecto
            }
        }
    };

    const handleNumberClick = (number) => {
        if (pin.length < 4 && step === 0) {
            const newPin = pin + number;
            setPin(newPin);
            setError('');

            if (newPin.length === 4 && step === 0) {
                setTimeout(() => {
                    setStep(1);
                }, 500);
            }
        } else if (confirmPin.length < 4 && step === 1) {
            const newConfirmPin = confirmPin + number;
            setConfirmPin(newConfirmPin);
            setError('');
        }
    };

    const handleBackspace = () => {
        if (step === 0 && pin.length > 0) {
            setPin(pin.slice(0, -1));
            setError('');
        } else if (step === 1 && confirmPin.length > 0) {
            setConfirmPin(confirmPin.slice(0, -1));
            setError('');
        }
    };

    const handleConfirmPIN = async () => {
        if (pin !== confirmPin) {
            setError('Los PINs no coinciden. Por favor, inténtalo de nuevo.');
            setConfirmPin('');
            return;
        }

        const pinsComunes = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234'];
        if (pinsComunes.includes(pin)) {
            setError('Por seguridad, elige un PIN menos común.');
            setPin('');
            setConfirmPin('');
            setStep(0);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/biometric/setup-pin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ pin })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('PIN configurado correctamente');
                setStep(2);
                
                if (data.biometricToken) {
                    localStorage.setItem('biometricToken', data.biometricToken);
                }

                setTimeout(() => {
                    onSuccess && onSuccess();
                    // No llamar onClose aquí si requiresSetup es true
                    if (!requiresSetup) {
                        handleCloseSafe();
                    }
                }, 2000);
            } else {
                setError(data.message || 'Error configurando PIN');
                setStep(0);
                setPin('');
                setConfirmPin('');
            }
        } catch (error) {
            setError('Error de conexión. Verifica tu conexión a internet.');
            setStep(0);
            setPin('');
            setConfirmPin('');
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Typography variant="body1" gutterBottom align="center">
                            Crea un PIN de 4 dígitos para seguridad adicional
                        </Typography>
                        
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
                            {pin.length}/4 dígitos
                        </Typography>

                        <Grid container spacing={1} justifyContent="center" sx={{ maxWidth: 300, margin: '0 auto' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                                <Grid item xs={4} key={number}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => handleNumberClick(number.toString())}
                                        disabled={pin.length >= 4}
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
                                    disabled={pin.length === 0}
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
                                    disabled={pin.length >= 4}
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
                                    onClick={() => setStep(1)}
                                    disabled={pin.length !== 4}
                                    sx={{
                                        width: '100%',
                                        height: 60,
                                        borderRadius: 2
                                    }}
                                >
                                    Siguiente
                                </Button>
                            </Grid>
                        </Grid>

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
                            PIN: {pin.replace(/./g, '•')}
                        </Typography>
                    </Box>
                );

            case 1:
                return (
                    <Box>
                        <Typography variant="body1" gutterBottom align="center">
                            Confirma tu PIN
                        </Typography>
                        
                        <Typography variant="body2" color="text.secondary" align="center">
                            PIN original: {pin.replace(/./g, '•')}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                            {[1, 2, 3, 4].map((index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        bgcolor: confirmPin.length >= index ? 'primary.main' : 'grey.300',
                                        mx: 1,
                                        transition: 'all 0.3s ease'
                                    }}
                                />
                            ))}
                        </Box>

                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                            {confirmPin.length}/4 dígitos
                        </Typography>

                        <Grid container spacing={1} justifyContent="center" sx={{ maxWidth: 300, margin: '0 auto' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                                <Grid item xs={4} key={number}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => handleNumberClick(number.toString())}
                                        disabled={confirmPin.length >= 4}
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
                                    disabled={confirmPin.length === 0}
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
                                    disabled={confirmPin.length >= 4}
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
                                    variant="outlined"
                                    onClick={() => {
                                        setStep(0);
                                        setConfirmPin('');
                                    }}
                                    sx={{
                                        width: '100%',
                                        height: 60,
                                        borderRadius: 2
                                    }}
                                >
                                    Atrás
                                </Button>
                            </Grid>
                        </Grid>

                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Button
                                variant="contained"
                                onClick={handleConfirmPIN}
                                disabled={confirmPin.length !== 4 || loading}
                                startIcon={loading ? <CircularProgress size={16} /> : <Fingerprint />}
                                sx={{ minWidth: 200 }}
                            >
                                {loading ? 'Configurando...' : 'Confirmar PIN'}
                            </Button>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
                            Confirmación: {confirmPin.replace(/./g, '•')}
                        </Typography>
                    </Box>
                );

            case 2:
                return (
                    <Box textAlign="center">
                        <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                            ¡PIN Configurado!
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Tu autenticación biométrica está activa
                        </Typography>
                    </Box>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={requiresSetup ? undefined : handleCloseSafe} // ← Usar función segura
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 3 }
            }}
        >
            <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    {step === 2 ? <CheckCircle color="success" /> : <Security color="primary" />}
                </Box>
                <Typography variant="h5" component="div">
                    {requiresSetup ? 'Configuración de Seguridad' : 'Autenticación Biométrica'}
                </Typography>
            </DialogTitle>

            <DialogContent>
                <Stepper activeStep={step} sx={{ mb: 3 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

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

                {renderStepContent()}

                {requiresSetup && step === 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        Para mayor seguridad, debes configurar un PIN de acceso de 4 dígitos.
                    </Alert>
                )}
            </DialogContent>

            <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                {step < 2 && !requiresSetup && (
                    <Button onClick={handleCloseSafe} disabled={loading}>
                        Cancelar
                    </Button>
                )}
            </DialogActions>

            <Backdrop open={loading} sx={{ zIndex: 1300 }}>
                <CircularProgress color="inherit" />
            </Backdrop>
        </Dialog>
    );
};

// Valores por defecto para evitar errores
PINSetup.defaultProps = {
    onClose: () => console.warn('onClose no proporcionado para PINSetup'),
    onSuccess: () => console.warn('onSuccess no proporcionado para PINSetup'),
};

export default PINSetup;