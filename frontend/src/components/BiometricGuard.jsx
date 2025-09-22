import React from 'react';
import { useNavigate } from 'react-router-dom';
import useBiometric from '../hooks/useBiometric';
import PINVerify from './PINVerify';
import PINSetup from './PINSetup';

const BiometricGuard = ({ children }) => {
    const navigate = useNavigate();
    const { biometricStatus, requiresBiometric, isBiometricVerified } = useBiometric();

    if (biometricStatus.loading) {
        return <div>Cargando...</div>;
    }

    if (biometricStatus.requiresSetup) {
        return (
            <PINSetup 
                open={true}
                requiresSetup={true}
                onSuccess={() => window.location.reload()}
            />
        );
    }

    if (requiresBiometric) {
        return (
            <PINVerify
                open={true}
                onVerify={() => window.location.reload()}
                onCancel={() => navigate('/')}
            />
        );
    }

    return children;
};

export default BiometricGuard;