import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box, Typography } from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRequiredRole, setHasRequiredRole] = useState(false);

  useEffect(() => {
    validateAuth();
  }, [location.pathname]);

  // ✅ FUNCIÓN PARA LIMPIAR TODAS LAS SESIONES
  const clearAllSessions = async () => {
    console.log('🧹 Limpiando todas las sesiones...');
    
    try {
      const token = localStorage.getItem('token');
      
      // Si hay token, intentar hacer logout en el servidor
      if (token) {
        try {
          await axios.post(`${API_URL}/auth/logout`, {}, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000 // 3 segundos máximo
          });
          console.log('✅ Sesión cerrada en el servidor');
        } catch (error) {
          console.log('⚠️ No se pudo cerrar sesión en servidor (puede estar offline)');
        }
      }
      
      // ✅ LIMPIEZA TOTAL DEL CLIENTE
      // Limpiar localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userLocation');
      localStorage.removeItem('biometricEnabled');
      localStorage.removeItem('biometricSetupComplete');
      
      // Limpiar sessionStorage
      sessionStorage.clear();
      
      // Limpiar cookies (si se usan)
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      console.log('✅ Todas las sesiones han sido limpiadas');
      
    } catch (error) {
      console.error('❌ Error limpiando sesiones:', error);
    }
  };

  // ✅ VALIDAR AUTENTICACIÓN
  const validateAuth = async () => {
    console.log('🔐 Validando autenticación para:', location.pathname);
    
    const token = localStorage.getItem('token');
    
    // Si no hay token, limpiar todo y redirigir
    if (!token) {
      console.log('❌ No se encontró token - Acceso no autorizado');
      await clearAllSessions();
      setIsAuthenticated(false);
      setIsValidating(false);
      return;
    }

    try {
      // Verificar token con el servidor
      const response = await axios.get(`${API_URL}/auth/verify-token`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });

      if (response.data.success && response.data.user) {
        const userRole = response.data.user.rol || 
                        JSON.parse(localStorage.getItem('user') || '{}').rol;
        
        console.log('✅ Token válido - Usuario autenticado');
        console.log('👤 Rol:', userRole);
        
        setIsAuthenticated(true);
        
        // Verificar rol si es requerido
        if (requiredRole) {
          const hasRole = userRole === requiredRole || userRole === 'admin';
          setHasRequiredRole(hasRole);
          
          if (!hasRole) {
            console.log(`⚠️ Usuario no tiene el rol requerido: ${requiredRole}`);
          }
        } else {
          setHasRequiredRole(true);
        }
        
      } else {
        throw new Error('Token inválido');
      }
      
    } catch (error) {
      console.error('❌ Error validando token:', error.message);
      
      // Si el token es inválido o expiró, limpiar TODAS las sesiones
      console.log('🚨 ACCESO NO AUTORIZADO DETECTADO');
      console.log('🧹 Cerrando TODAS las sesiones activas...');
      
      await clearAllSessions();
      setIsAuthenticated(false);
      setHasRequiredRole(false);
      
    } finally {
      setIsValidating(false);
    }
  };

  // ✅ PANTALLA DE CARGA MIENTRAS VALIDA
  if (isValidating) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2
        }}
      >
        <CircularProgress size={50} />
        <Typography variant="body1" color="text.secondary">
          Verificando autenticación...
        </Typography>
      </Box>
    );
  }

  // ✅ SI NO ESTÁ AUTENTICADO, REDIRIGIR A LOGIN
  if (!isAuthenticated) {
    console.log('🔒 Redirigiendo a login...');
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // ✅ SI NO TIENE EL ROL REQUERIDO, REDIRIGIR A DASHBOARD O ACCESO DENEGADO
  if (requiredRole && !hasRequiredRole) {
    console.log('⛔ Acceso denegado - Rol insuficiente');
    return <Navigate to="/access-denied" replace />;
  }

  // ✅ TODO OK, MOSTRAR EL COMPONENTE PROTEGIDO
  return children;
};

export default ProtectedRoute;