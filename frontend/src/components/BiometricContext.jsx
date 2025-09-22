import React, { createContext, useContext, useState, useEffect } from 'react';

const BiometricContext = createContext();

export const useBiometric = () => {
  const context = useContext(BiometricContext);
  if (!context) {
    throw new Error('useBiometric debe usarse dentro de BiometricProvider');
  }
  return context;
};

export const BiometricProvider = ({ children }) => {
  const [biometricStatus, setBiometricStatus] = useState({
    enabled: false,
    requiresSetup: false,
    isLocked: false,
    lockedUntil: null,
    loading: true
  });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const checkBiometricStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setBiometricStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      const response = await fetch(`${API_URL}/biometric/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

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
  };

  const isBiometricVerified = () => {
    const biometricToken = localStorage.getItem('biometricToken');
    if (!biometricToken) return false;

    try {
      const payload = JSON.parse(atob(biometricToken.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  };

  const clearBiometricSession = () => {
    localStorage.removeItem('biometricToken');
    setBiometricStatus(prev => ({ ...prev, enabled: false }));
  };

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const value = {
    biometricStatus,
    checkBiometricStatus,
    isBiometricVerified,
    clearBiometricSession,
    requiresBiometric: biometricStatus.enabled && !isBiometricVerified() && !biometricStatus.loading
  };

  return (
    <BiometricContext.Provider value={value}>
      {children}
    </BiometricContext.Provider>
  );
};