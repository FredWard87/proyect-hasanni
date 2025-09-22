import { useState, useEffect, useCallback } from 'react';

const useBiometric = () => {
    const [biometricStatus, setBiometricStatus] = useState({
        enabled: false,
        requiresSetup: false,
        isLocked: false,
        lockedUntil: null,
        loading: true
    });

    const checkBiometricStatus = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(
                `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/biometric/status`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setBiometricStatus({
                    enabled: data.biometricEnabled,
                    requiresSetup: data.requiresSetup,
                    isLocked: data.isLocked,
                    lockedUntil: data.lockedUntil,
                    loading: false
                });
            } else {
                setBiometricStatus(prev => ({ ...prev, loading: false }));
            }
        } catch (error) {
            setBiometricStatus(prev => ({ ...prev, loading: false }));
        }
    }, []);

    const isBiometricVerified = useCallback(() => {
        const biometricToken = localStorage.getItem('biometricToken');
        if (!biometricToken) return false;

        try {
            // Verificar expiración básica del token
            const payload = JSON.parse(atob(biometricToken.split('.')[1]));
            return payload.exp * 1000 > Date.now();
        } catch {
            return false;
        }
    }, []);

    useEffect(() => {
        checkBiometricStatus();
    }, [checkBiometricStatus]);

    return {
        biometricStatus,
        checkBiometricStatus,
        isBiometricVerified,
        requiresBiometric: biometricStatus.enabled && !isBiometricVerified()
    };
};

export default useBiometric;