import React, { useEffect, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import Usuarios from './components/Usuario';
import Loginsito from './components/Auth/Login';
import Register from './components/Auth/Registro';
import ForgotPassword from './components/Auth/Recuperar';
import ResetPassword from './components/Auth/Resetear';
import LocationManager from './components/Ubicacion';
import Shoppi from './components/ShoppingCart';
import AdminPayments from './components/AdminPayments';
import PreferentUserMode from './components/preferentuser';
import Campanita from './components/NotificationBell.js'

// AGREGAR ESTOS IMPORTS:
import { PaymentSuccess, PaymentCancel } from './components/paypal';

// IMPORTAR EL PROVIDER DE PREFERENCIAS Y BIOMÉTRICO
import { PreferencesProvider } from './components/PreferencesContext';
import { BiometricProvider } from './components/BiometricContext';

// IMPORTAR COMPONENTES BIOMÉTRICOS
import BiometricGuard from './components/BiometricGuard';

import './App.css';

// 🔐 INTERFACE PARA LAS PROPS DE LOS GUARDS
interface GuardProps {
  children: ReactNode;
}

// 🔐 COMPONENTE GUARD PARA VERIFICAR AUTENTICACIÓN
const AuthGuard = ({ children }: GuardProps) => {
  const location = useLocation();
  
  // Verificar si el usuario está autenticado
  const isAuthenticated = (): boolean => {
    const token = localStorage.getItem('token');
    return !!token; // Devuelve true si existe token
  };

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated()) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// 🔄 COMPONENTE PARA REDIRIGIR USUARIOS AUTENTICADOS (evitar que vayan al login si ya están logueados)
const PublicRoute = ({ children }: GuardProps) => {
  const isAuthenticated = (): boolean => {
    const token = localStorage.getItem('token');
    return !!token;
  };

  // Si está autenticado, redirigir a la página principal
  if (isAuthenticated()) {
    return <Navigate to="/Usuarios" replace />;
  }

  return <>{children}</>;
};

// ✅ NUEVO COMPONENTE PARA RUTAS COMPLETAMENTE PÚBLICAS (sin redirección)
const FullyPublicRoute = ({ children }: GuardProps) => {
  // Este componente NO redirige, permite acceso sin importar el estado de autenticación
  return <>{children}</>;
};

// Componente para capturar el token de Google y redirigir
function TokenHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const authError = params.get('authError');
    
    // Solo procesar si estamos en la página principal
    if (location.pathname === '/') {
      // Manejar error de autenticación primero
      if (authError) {
        console.log('🔴 Error de autenticación:', authError);
        // Limpiar parámetros de la URL sin recargar
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }
      
      // Manejar éxito de autenticación
      if (token) {
        console.log('✅ Token recibido de Google');
        localStorage.setItem('token', token);
        
        // Limpiar parámetros de la URL inmediatamente
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // Redirigir después de limpiar la URL
        setTimeout(() => {
          navigate('/Usuarios');
        }, 100);
      }
    }
  }, [navigate, location]);

  return null;
}

// Componente para página de éxito de autenticación
function AuthSuccess() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      localStorage.setItem('token', token);
      setTimeout(() => {
        navigate('/Usuarios');
      }, 1000);
    } else {
      navigate('/');
    }
  }, [navigate]);
  
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>✅ Autenticación Exitosa</h2>
      <p>Redirigiendo a la página principal...</p>
    </div>
  );
}

// Componente para página de error de autenticación
function AuthError() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const message = params.get('message') || 'Error de autenticación';
  
  useEffect(() => {
    setTimeout(() => {
      navigate('/');
    }, 3000);
  }, [navigate]);
  
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>❌ Error de Autenticación</h2>
      <p>{message}</p>
      <p>Redirigiendo al login...</p>
      <button onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
        Volver al Login
      </button>
    </div>
  );
}

// 🚀 COMPONENTE PARA CERRAR SESIÓN (limpia todo y redirige adecuadamente)
export const logoutService = {
  cerrarSesion: (): void => {
    // Limpiar todos los datos de autenticación
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('userPreferences');
    sessionStorage.clear();
    
    // Forzar recarga limpia hacia el login
    window.location.href = '/';
    // Alternativa: window.location.replace('/');
  }
};

function App() {
  return (
    <div className="App">
      <PreferencesProvider>
        <BiometricProvider>
          <Router>
            <TokenHandler />
            <Routes>
              {/* 🔐 RUTAS PROTEGIDAS - Requieren autenticación */}
              <Route path="/Usuarios" element={
                <AuthGuard>
                  <BiometricGuard>
                    <Usuarios />
                  </BiometricGuard>
                </AuthGuard>
              } />
              
              <Route path="/locations" element={
                <AuthGuard>
                  <BiometricGuard>
                    <LocationManager />
                  </BiometricGuard>
                </AuthGuard>
              } />
              
              <Route path="/shop" element={
                <AuthGuard>
                  <BiometricGuard>
                    <Shoppi />
                  </BiometricGuard>
                </AuthGuard>
              } />
              
              <Route path="/preferentuser" element={
                <AuthGuard>
                  <BiometricGuard>
                    <PreferentUserMode />
                  </BiometricGuard>
                </AuthGuard>
              } />
              
              <Route path="/admin/pagos" element={
                <AuthGuard>
                  <BiometricGuard>
                    <AdminPayments />
                  </BiometricGuard>
                </AuthGuard>
              } />

              <Route path="/notifications" element={
                <AuthGuard>
                  <Campanita />
                </AuthGuard>
              } />
              
              {/* 🔐 Rutas de PayPal protegidas */}
              <Route path="/payment/success" element={
                <AuthGuard>
                  <PaymentSuccess />
                </AuthGuard>
              } />
              
              <Route path="/payment/cancel" element={
                <AuthGuard>
                  <PaymentCancel />
                </AuthGuard>
              } />

              {/* 🌐 RUTAS PÚBLICAS - Redirigen si ya está autenticado */}
              <Route path="/" element={
                <PublicRoute>
                  <Loginsito />
                </PublicRoute>
              } />
              
              <Route path="/register" element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } />
              
              <Route path="/forgot-password" element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              } />
              
              {/* ✅ RUTA DE RESET PASSWORD COMPLETAMENTE PÚBLICA (sin redirección) */}
              <Route path="/reset-password/:token" element={
                <FullyPublicRoute>
                  <ResetPassword />
                </FullyPublicRoute>
              } />
              
              {/* ✅ RUTAS DE AUTENTICACIÓN GOOGLE (públicas) */}
              <Route path="/auth/success" element={
                <FullyPublicRoute>
                  <AuthSuccess />
                </FullyPublicRoute>
              } />
              
              <Route path="/auth/error" element={
                <FullyPublicRoute>
                  <AuthError />
                </FullyPublicRoute>
              } />
              
              {/* 🔄 Ruta por defecto para autenticados */}
              <Route path="/" element={<Navigate to="/Usuarios" replace />} />
              
              {/* 🚫 Ruta catch-all para manejar URLs no encontradas */}
              <Route path="*" element={
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <h2>Página no encontrada</h2>
                  <button onClick={() => window.location.href = '/'}>
                    Volver al inicio
                  </button>
                </div>
              } />
            </Routes>
          </Router>
        </BiometricProvider>
      </PreferencesProvider>
    </div>
  );
}

export default App;