import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Typography, Button, Alert, TextField,
    CircularProgress, Stepper, Step, StepLabel, Grid
} from '@mui/material';
import { Security, CheckCircle, Backspace, VerifiedUser, LockReset } from '@mui/icons-material';

const PINResetVerify = ({ open, onClose, onSuccess, email }) => {
    const [step, setStep] = useState(0);
    const [resetCode, setResetCode] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [attemptsLeft, setAttemptsLeft] = useState(3);
    const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutos en segundos

    const steps = ['Verificar Código', 'Nuevo PIN', 'Confirmar PIN', 'Completado'];

    // Countdown timer
    useEffect(() => {
        if (open && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        setError('El código ha expirado. Solicita uno nuevo.');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [open, timeLeft]);

    useEffect(() => {
        if (open) {
            setStep(0);
            setResetCode('');
            setNewPin('');
            setConfirmPin('');
            setError('');
            setSuccess('');
            setAttemptsLeft(3);
            setTimeLeft(15 * 60);
        }
    }, [open]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

   const handleVerifyCode = async () => {
    if (!resetCode || resetCode.length !== 6) {
        setError('El código debe tener 6 caracteres');
        return;
    }

    setLoading(true);
    setError('');

    try {
        // CAMBIA ESTA LÍNEA - usa verify-code-only en lugar de verify-reset-code
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/biometric/verify-code-only`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email, 
                resetCode 
            })
        });

        const data = await response.json();

        if (data.success) {
            setStep(1); // Pasar al paso de nuevo PIN
            setError('');
        } else {
            setError(data.message || 'Código incorrecto');
            if (data.attemptsLeft !== undefined) {
                setAttemptsLeft(data.attemptsLeft);
            }
        }

    } catch (error) {
        setError('Error verificando código');
    } finally {
        setLoading(false);
    }
};

    const handleNumberClick = (number) => {
        if (step === 1 && newPin.length < 4) {
            const newPinValue = newPin + number;
            setNewPin(newPinValue);
            setError('');

            if (newPinValue.length === 4) {
                setTimeout(() => setStep(2), 500);
            }
        } else if (step === 2 && confirmPin.length < 4) {
            const newConfirmPin = confirmPin + number;
            setConfirmPin(newConfirmPin);
            setError('');
        }
    };

    const handleBackspace = () => {
        if (step === 1 && newPin.length > 0) {
            setNewPin(newPin.slice(0, -1));
            setError('');
        } else if (step === 2 && confirmPin.length > 0) {
            setConfirmPin(confirmPin.slice(0, -1));
            setError('');
        }
    };

   const handleResetPIN = async () => {
    if (newPin !== confirmPin) {
        setError('Los PINs no coinciden');
        setConfirmPin('');
        return;
    }

    const pinsComunes = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234'];
    if (pinsComunes.includes(newPin)) {
        setError('Por seguridad, elige un PIN menos común');
        setNewPin('');
        setConfirmPin('');
        setStep(1);
        return;
    }

    setLoading(true);

    try {
        // CAMBIA ESTA LÍNEA - usa reset-pin-final en lugar de reset-pin
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/biometric/reset-pin-final`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                resetCode,
                newPin
            })
        });

        const data = await response.json();

        if (data.success) {
            setSuccess('PIN restablecido correctamente');
            setStep(3);
            setTimeout(() => {
                onSuccess && onSuccess();
                onClose && onClose();
            }, 2000);
        } else {
            setError(data.message || 'Error restableciendo PIN');
            if (data.message && data.message.includes('Código incorrecto')) {
                setStep(0); // Volver a verificar código
                setResetCode('');
            }
        }

    } catch (error) {
        setError('Error restableciendo PIN');
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
                            Ingresa el código de 6 dígitos enviado a tu email
                        </Typography>
                        
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                            {email && `Código enviado a: ${email.replace(/(.{3}).*(@.*)/, '$1***$2')}`}
                        </Typography>

                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                            <Typography variant="body2" color={timeLeft < 300 ? 'error' : 'text.secondary'}>
                                Expira en: {formatTime(timeLeft)}
                            </Typography>
                        </Box>

                        <TextField
                            fullWidth
                            label="Código de Verificación"
                            value={resetCode}
                            onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                            disabled={loading || timeLeft === 0}
                            inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '0.5em' } }}
                            sx={{ mb: 3 }}
                            autoFocus
                        />

                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                            Intentos restantes: {attemptsLeft}
                        </Typography>

                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Button
                                variant="contained"
                                onClick={handleVerifyCode}
                                disabled={resetCode.length !== 6 || loading || timeLeft === 0}
                                startIcon={loading ? <CircularProgress size={16} /> : <VerifiedUser />}
                                sx={{ minWidth: 200 }}
                            >
                                {loading ? 'Verificando...' : 'Verificar Código'}
                            </Button>
                        </Box>
                    </Box>
                );

            case 1:
                return (
                    <Box>
                        <Typography variant="body1" gutterBottom align="center">
                            Crea tu nuevo PIN de 4 dígitos
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                            {[1, 2, 3, 4].map((index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        bgcolor: newPin.length >= index ? 'primary.main' : 'grey.300',
                                        mx: 1,
                                        transition: 'all 0.3s ease'
                                    }}
                                />
                            ))}
                        </Box>

                        <Grid container spacing={1} justifyContent="center" sx={{ maxWidth: 300, margin: '0 auto' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                                <Grid item xs={4} key={number}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => handleNumberClick(number.toString())}
                                        disabled={newPin.length >= 4}
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
                                    disabled={newPin.length === 0}
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
                                    disabled={newPin.length >= 4}
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
                                    onClick={() => setStep(2)}
                                    disabled={newPin.length !== 4}
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

                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setStep(0);
                                    setNewPin('');
                                }}
                            >
                                Atrás
                            </Button>
                        </Box>
                    </Box>
                );

            case 2:
                return (
                    <Box>
                        <Typography variant="body1" gutterBottom align="center">
                            Confirma tu nuevo PIN
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
                                    variant="contained"
                                    onClick={handleResetPIN}
                                    disabled={confirmPin.length !== 4 || loading}
                                    startIcon={loading ? <CircularProgress size={16} /> : <LockReset />}
                                    sx={{
                                        width: '100%',
                                        height: 60,
                                        borderRadius: 2
                                    }}
                                >
                                    {loading ? 'Guardando...' : 'Restablecer'}
                                </Button>
                            </Grid>
                        </Grid>

                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setStep(1);
                                    setConfirmPin('');
                                }}
                                disabled={loading}
                                sx={{ mr: 2 }}
                            >
                                Atrás
                            </Button>
                        </Box>
                    </Box>
                );

            case 3:
                return (
                    <Box textAlign="center">
                        <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                            ¡PIN Restablecido!
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Ya puedes usar tu nuevo PIN para acceder
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
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 3 }
            }}
        >
            <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    {step === 3 ? <CheckCircle color="success" /> : <Security color="primary" />}
                </Box>
                <Typography variant="h5" component="div">
                    Restablecer PIN
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
            </DialogContent>

            <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                {step < 3 && (
                    <Button onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default PINResetVerify;