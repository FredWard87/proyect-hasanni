import React, { useEffect, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
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
import Inventory from './components/Reportes';
import Proveedores from './components/Proveedores';
import SessionMonitor from './SessionMonitor';

// AGREGAR ESTOS IMPORTS:
import { PaymentSuccess, PaymentCancel } from './components/paypal';

// IMPORTAR EL PROVIDER DE PREFERENCIAS Y BIOMÉTRICO
import { PreferencesProvider } from './components/PreferencesContext';
import { BiometricProvider } from './components/BiometricContext';

// IMPORTAR COMPONENTES BIOMÉTRICOS
import BiometricGuard from './components/BiometricGuard';

import './App.css';
import { Toaster } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// 🔐 INTERFACE PARA LAS PROPS DE LOS GUARDS
interface GuardProps {
  children: ReactNode;
}

// 🌐 SERVICIO DE SINCRONIZACIÓN ENTRE PESTAÑAS
class TabSyncService {
  private channel: BroadcastChannel;
  private static instance: TabSyncService;

  constructor() {
    this.channel = new BroadcastChannel('auth-sync');
    this.setupListeners();
  }

  static getInstance(): TabSyncService {
    if (!TabSyncService.instance) {
      TabSyncService.instance = new TabSyncService();
    }
    return TabSyncService.instance;
  }

  private setupListeners() {
    this.channel.addEventListener('message', (event) => {
      console.log('📡 Mensaje recibido entre pestañas:', event.data);
      
      switch (event.data.type) {
        case 'SESSION_EXPIRED':
          console.log('🚨 Sesión expirada en otra pestaña - Cerrando sesión local');
          this.handleSessionExpiration();
          break;
        
        case 'LOGOUT_REQUEST':
          console.log('🚨 Logout solicitado desde otra pestaña');
          this.handleLogoutRequest();
          break;
        
        case 'AUTH_STATE_CHANGE':
          console.log('🔄 Cambio de estado de autenticación en otra pestaña');
          this.handleAuthStateChange(event.data.payload);
          break;
      }
    });
  }

  private async handleSessionExpiration() {
    await clearAllSessions();
    toast.error('🔒 Sesión expirada en otra pestaña. Redirigiendo...', {
      duration: 4000,
      position: 'top-center'
    });
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
  }

  private async handleLogoutRequest() {
    await clearAllSessions();
    toast('🚪 Sesión cerrada desde otra pestaña', {
      duration: 3000,
      position: 'top-center'
    });
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }

  private handleAuthStateChange(payload: any) {
    console.log('Estado de auth cambiado:', payload);
  }

  // 🔄 MÉTODOS PARA ENVIAR MENSAJES
  broadcastSessionExpired() {
    this.channel.postMessage({
      type: 'SESSION_EXPIRED',
      timestamp: new Date().toISOString(),
      source: 'auth-guard'
    });
  }

  broadcastLogout() {
    this.channel.postMessage({
      type: 'LOGOUT_REQUEST',
      timestamp: new Date().toISOString(),
      source: 'logout-service'
    });
  }

  broadcastAuthStateChange(payload: any) {
    this.channel.postMessage({
      type: 'AUTH_STATE_CHANGE',
      timestamp: new Date().toISOString(),
      payload
    });
  }
}

// ✅ FUNCIÓN PARA LIMPIAR TODAS LAS SESIONES (BACKEND + FRONTEND) - MEJORADA
const clearAllSessions = async (source: string = 'unknown'): Promise<void> => {
  const startTime = Date.now();
  console.log(`%c🧹 === INICIANDO LIMPIEZA TOTAL DE SESIONES (${source}) ===`, 'background: #ff6b6b; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  console.log('⏰ Timestamp:', new Date().toLocaleString());
  
  const cleanupReport = {
    timestamp: new Date().toISOString(),
    source: source,
    backendLogout: false,
    localStorageCleared: false,
    sessionStorageCleared: false,
    cookiesCleared: false,
    errors: [] as string[],
    duration: 0
  };
  
  try {
    const token = localStorage.getItem('token');
    console.log('🔍 Token encontrado:', token ? `${token.substring(0, 20)}...` : 'NINGUNO');
    
    // 1️⃣ Cerrar sesión en el servidor si hay token
    if (token) {
      try {
        console.log('📡 Enviando solicitud de logout al servidor...');
        const response = await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 3000
        });
        
        if (response.data.success) {
          console.log('%c✅ Sesión cerrada en el servidor correctamente', 'color: #51cf66; font-weight: bold;');
          cleanupReport.backendLogout = true;
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Error desconocido';
        console.log('%c⚠️ No se pudo cerrar sesión en servidor', 'color: #ffa94d; font-weight: bold;');
        console.log('   Razón:', errorMsg);
        cleanupReport.errors.push(`Backend: ${errorMsg}`);
      }
    } else {
      console.log('ℹ️ No hay token para cerrar en el servidor');
    }
    
    // 2️⃣ LIMPIEZA TOTAL DEL FRONTEND
    console.log('\n🗑️ Limpiando datos del navegador...');
    
    // Limpiar localStorage - MÁS EXHAUSTIVO
    const keysToRemove = [
      'token',
      'user',
      'usuario',
      'userLocation',
      'biometricEnabled',
      'biometricSetupComplete',
      'userPreferences',
      'offlineLocationQueue',
      'biometricToken',
      'sessionData',
      'authToken',
      'refreshToken',
      'userData',
      'currentUser'
    ];
    
    console.log('📦 localStorage ANTES:');
    const beforeLocalStorage: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        beforeLocalStorage[key] = value ? value.substring(0, 30) + '...' : 'null';
      }
    }
    console.table(beforeLocalStorage);
    
    // Eliminar todas las keys conocidas
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Eliminar cualquier otra key que pueda ser de sesión
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('token') || key.includes('auth') || key.includes('user') || key.includes('session'))) {
        localStorage.removeItem(key);
        console.log(`🗑️ Eliminada key adicional: ${key}`);
      }
    }
    
    cleanupReport.localStorageCleared = true;
    console.log('%c✅ localStorage limpiado completamente', 'color: #51cf66; font-weight: bold;');
    
    // Verificar limpieza
    console.log('📦 localStorage DESPUÉS:');
    const afterLocalStorage: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        afterLocalStorage[key] = localStorage.getItem(key);
      }
    }
    
    if (Object.keys(afterLocalStorage).length === 0) {
      console.log('   ✅ Todos los items fueron eliminados correctamente');
    } else {
      console.log('   ⚠️ Algunos items permanecen:', afterLocalStorage);
      // Forzar limpieza total
      localStorage.clear();
      console.log('   🔄 Limpieza forzada completada');
    }
    
    // Limpiar sessionStorage
    const sessionStorageLength = sessionStorage.length;
    sessionStorage.clear();
    cleanupReport.sessionStorageCleared = true;
    console.log(`%c✅ sessionStorage limpiado (${sessionStorageLength} items)`, 'color: #51cf66; font-weight: bold;');
    
    // Limpiar cookies MÁS AGRESIVO
    const cookiesBefore = document.cookie.split(';').length;
    const cookiesToRemove = [
      'token', 'auth', 'session', 'user', 'refresh'
    ];
    
    // Eliminar cookies específicas y generales
    document.cookie.split(";").forEach((c) => {
      const cookieName = c.split("=")[0].trim();
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    });
    
    const cookiesAfter = document.cookie.split(';').filter(c => c.trim()).length;
    cleanupReport.cookiesCleared = true;
    console.log(`%c✅ Cookies limpiadas (${cookiesBefore} → ${cookiesAfter})`, 'color: #51cf66; font-weight: bold;');
    
    cleanupReport.duration = Date.now() - startTime;
    
    console.log('\n%c✅ === LIMPIEZA COMPLETADA EXITOSAMENTE ===', 'background: #51cf66; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
    console.log('⏱️ Duración:', cleanupReport.duration + 'ms');
    console.log('📊 Reporte de limpieza:');
    console.table({
      'Fuente': cleanupReport.source,
      'Logout Backend': cleanupReport.backendLogout ? '✅' : '❌',
      'localStorage': cleanupReport.localStorageCleared ? '✅' : '❌',
      'sessionStorage': cleanupReport.sessionStorageCleared ? '✅' : '❌',
      'Cookies': cleanupReport.cookiesCleared ? '✅' : '❌',
      'Errores': cleanupReport.errors.length || 'Ninguno',
      'Duración (ms)': cleanupReport.duration
    });
    
    if (cleanupReport.errors.length > 0) {
      console.log('%c⚠️ Errores encontrados:', 'color: #ffa94d; font-weight: bold;');
      cleanupReport.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }
    
  } catch (error) {
    console.error('%c❌ Error crítico limpiando sesiones:', 'color: #ff6b6b; font-weight: bold;', error);
    cleanupReport.errors.push(`Error crítico: ${error}`);
  }
  
  return;
};

// 🔐 COMPONENTE GUARD MEJORADO CON SINCRONIZACIÓN ENTRE PESTAÑAS
const AuthGuard = ({ children }: GuardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const tabSync = TabSyncService.getInstance();

  useEffect(() => {
    validateAuth();
  }, [location.pathname]);

  const validateAuth = async () => {
    console.log('%c🔐 VALIDANDO AUTENTICACIÓN', 'background: #4dabf7; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
    console.log('📍 Ruta solicitada:', location.pathname);
    
    const token = localStorage.getItem('token');
    
    // ✅ SI NO HAY TOKEN, LIMPIAR TODO Y REDIRIGIR + NOTIFICAR OTRAS PESTAÑAS
    if (!token) {
      console.log('%c❌ NO SE ENCONTRÓ TOKEN', 'background: #ff6b6b; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
      console.log('🚨 Acceso no autorizado detectado');
      console.log('🧹 Iniciando limpieza de todas las sesiones...');
      
      // Mostrar notificación visual
      toast.error('⛔ Acceso no autorizado. Cerrando todas las sesiones...', {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#ff6b6b',
          color: '#fff',
          fontWeight: 'bold',
        },
      });
      
      // Limpiar sesiones locales
      await clearAllSessions('auth-guard-unauthorized');
      
      // 🔄 NOTIFICAR A TODAS LAS PESTAÑAS QUE CIERREN SESIÓN
      tabSync.broadcastSessionExpired();
      
      // Notificación de confirmación
      toast.success('✅ Todas las sesiones han sido cerradas', {
        duration: 3000,
        position: 'top-center',
      });
      
      setIsAuthenticated(false);
      setIsValidating(false);
      return;
    }

    try {
      console.log('📡 Verificando token con el servidor...');
      
      // Verificar token con el servidor
      const response = await axios.get(`${API_URL}/auth/verify-token`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });

      if (response.data.success && response.data.user) {
        console.log('%c✅ TOKEN VÁLIDO', 'background: #51cf66; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
        console.log('👤 Usuario:', response.data.user.email || response.data.user.nombre);
        console.log('🔑 Rol:', response.data.user.rol);
        console.log('✅ Acceso permitido a:', location.pathname);
        
        setIsAuthenticated(true);
      } else {
        throw new Error('Token inválido - Respuesta incorrecta del servidor');
      }
      
    } catch (error: any) {
      console.log('%c❌ ERROR DE VALIDACIÓN', 'background: #ff6b6b; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
      console.error('Detalles del error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      console.log('🚨 ACCESO NO AUTORIZADO DETECTADO');
      console.log('🧹 CERRANDO TODAS LAS SESIONES ACTIVAS...');
      
      // Mostrar notificación de error
      const errorMessage = error.response?.status === 401 
        ? '🔒 Token expirado o inválido' 
        : '❌ Error de autenticación';
      
      toast.error(`${errorMessage}. Cerrando sesiones...`, {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#ff6b6b',
          color: '#fff',
          fontWeight: 'bold',
        },
      });
      
      // ✅ LIMPIAR TODAS LAS SESIONES SI EL TOKEN ES INVÁLIDO
      await clearAllSessions('auth-guard-token-invalid');
      
      // 🔄 NOTIFICAR A TODAS LAS PESTAÑAS QUE CIERREN SESIÓN
      tabSync.broadcastSessionExpired();
      
      // Notificación de confirmación
      toast.success('✅ Sesiones cerradas correctamente', {
        duration: 3000,
        position: 'top-center',
      });
      
      setIsAuthenticated(false);
      
    } finally {
      setIsValidating(false);
    }
  };

  // Pantalla de carga mientras valida
  if (isValidating) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem'
      }}>
        <div className="spinner" style={{
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite'
        }} />
        <p>Verificando autenticación...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    console.log('🔒 Redirigiendo a login...');
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  // Todo OK, mostrar el componente protegido
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

// 🚀 SERVICIO MEJORADO PARA CERRAR SESIÓN CON SINCRONIZACIÓN
export const logoutService = {
  cerrarSesion: async (): Promise<void> => {
    console.log('%c🚪 CERRANDO SESIÓN MANUALMENTE', 'background: #fab005; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
    console.log('👤 Usuario solicitó cerrar sesión');
    console.log('⏰ Timestamp:', new Date().toLocaleString());
    
    const tabSync = TabSyncService.getInstance();
    
    // Mostrar notificación
    toast.loading('Cerrando sesión...', {
      duration: 2000,
      position: 'top-center',
    });
    
    // Limpiar todas las sesiones (backend + frontend)
    await clearAllSessions('manual-logout');
    
    // 🔄 NOTIFICAR A TODAS LAS PESTAÑAS QUE CIERREN SESIÓN
    tabSync.broadcastLogout();
    
    // Notificación de éxito
    toast.success('✅ Sesión cerrada exitosamente', {
      duration: 3000,
      position: 'top-center',
    });
    
    console.log('🔒 Redirigiendo a login...');
    
    // Forzar recarga limpia hacia el login
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  }
};

function App() {
  // ✅ INICIALIZAR SERVICIO DE SINCRONIZACIÓN AL MONTAR LA APP
  useEffect(() => {
    const tabSync = TabSyncService.getInstance();
    console.log('🌐 Servicio de sincronización entre pestañas inicializado');
    
    return () => {
      console.log('🛑 App desmontada');
    };
  }, []);

  return (
    <div className="App">
      {/* ✅ TOASTER PARA NOTIFICACIONES GLOBALES */}
      <Toaster 
        position="top-center"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#51cf66',
              secondary: '#fff',
            },
            style: {
              background: '#51cf66',
              color: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ff6b6b',
              secondary: '#fff',
            },
            style: {
              background: '#ff6b6b',
              color: '#fff',
            },
          },
          loading: {
            iconTheme: {
              primary: '#4dabf7',
              secondary: '#fff',
            },
            style: {
              background: '#4dabf7',
              color: '#fff',
            },
          },
        }}
      />
      
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

              <Route path="/proveedores" element={
                <AuthGuard>
                  <BiometricGuard>
                    <Proveedores />
                  </BiometricGuard>
                </AuthGuard>
              } />
              
              <Route path="/reportes" element={
                <AuthGuard>
                  <BiometricGuard>
                    <Inventory />
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

              {/* 🔍 RUTA PARA EL MONITOR DE SESIONES (SOLO DESARROLLO) */}
              <Route path="/session-monitor" element={
                <AuthGuard>
                  <SessionMonitor />
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