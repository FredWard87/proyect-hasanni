import React, { useState, useEffect } from 'react';
import { logoutService } from '../src/App';
import './SessionMonitor.css';

interface SessionData {
  token: string | null;
  user: any;
  localStorageKeys: string[];
  sessionStorageKeys: string[];
  cookies: number;
  isAuthenticated: boolean;
}

const SessionMonitor: React.FC = () => {
  const [sessionData, setSessionData] = useState<SessionData>({
    token: null,
    user: null,
    localStorageKeys: [],
    sessionStorageKeys: [],
    cookies: 0,
    isAuthenticated: false
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshSessionData = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    // Obtener todas las keys de localStorage
    const localKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) localKeys.push(key);
    }
    
    // Obtener todas las keys de sessionStorage
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) sessionKeys.push(key);
    }
    
    // Contar cookies
    const cookieCount = document.cookie.split(';').filter(c => c.trim()).length;
    
    setSessionData({
      token: token ? `${token.substring(0, 30)}...` : null,
      user: user ? JSON.parse(user) : null,
      localStorageKeys: localKeys,
      sessionStorageKeys: sessionKeys,
      cookies: cookieCount,
      isAuthenticated: !!token
    });
  };

  useEffect(() => {
    refreshSessionData();
    
    if (autoRefresh) {
      const interval = setInterval(refreshSessionData, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleLogout = async () => {
    if (window.confirm('¿Estás seguro de cerrar sesión? Se limpiarán TODAS las sesiones activas.')) {
      await logoutService.cerrarSesion();
    }
  };

  const handleClearLocalStorage = () => {
    localStorage.clear();
    refreshSessionData();
    console.log('🗑️ localStorage limpiado manualmente');
  };

  const handleClearSessionStorage = () => {
    sessionStorage.clear();
    refreshSessionData();
    console.log('🗑️ sessionStorage limpiado manualmente');
  };

  return (
    <div className="session-monitor">
      <div className="monitor-header">
        <h2>🔍 Monitor de Sesiones</h2>
        <div className="header-controls">
          <label className="auto-refresh">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (1s)
          </label>
          <button onClick={refreshSessionData} className="btn-refresh">
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div className="monitor-grid">
        {/* Estado de Autenticación */}
        <div className={`monitor-card ${sessionData.isAuthenticated ? 'authenticated' : 'not-authenticated'}`}>
          <h3>🔐 Estado de Autenticación</h3>
          <div className="status-badge">
            {sessionData.isAuthenticated ? (
              <>
                <span className="badge success">✅ AUTENTICADO</span>
                <p className="user-info">
                  {sessionData.user?.nombre || sessionData.user?.email || 'Usuario desconocido'}
                </p>
              </>
            ) : (
              <span className="badge danger">❌ NO AUTENTICADO</span>
            )}
          </div>
        </div>

        {/* Token */}
        <div className="monitor-card">
          <h3>🔑 Token JWT</h3>
          {sessionData.token ? (
            <div className="token-display">
              <code>{sessionData.token}</code>
              <span className="badge success">Presente</span>
            </div>
          ) : (
            <span className="badge danger">No hay token</span>
          )}
        </div>

        {/* localStorage */}
        <div className="monitor-card">
          <h3>📦 localStorage ({sessionData.localStorageKeys.length} items)</h3>
          {sessionData.localStorageKeys.length > 0 ? (
            <div className="storage-list">
              {sessionData.localStorageKeys.map(key => (
                <div key={key} className="storage-item">
                  <span className="key">{key}</span>
                  <span className="value">
                    {localStorage.getItem(key)?.substring(0, 30)}...
                  </span>
                </div>
              ))}
              <button onClick={handleClearLocalStorage} className="btn-clear">
                🗑️ Limpiar localStorage
              </button>
            </div>
          ) : (
            <span className="badge success">✅ Vacío</span>
          )}
        </div>

        {/* sessionStorage */}
        <div className="monitor-card">
          <h3>💾 sessionStorage ({sessionData.sessionStorageKeys.length} items)</h3>
          {sessionData.sessionStorageKeys.length > 0 ? (
            <div className="storage-list">
              {sessionData.sessionStorageKeys.map(key => (
                <div key={key} className="storage-item">
                  <span className="key">{key}</span>
                </div>
              ))}
              <button onClick={handleClearSessionStorage} className="btn-clear">
                🗑️ Limpiar sessionStorage
              </button>
            </div>
          ) : (
            <span className="badge success">✅ Vacío</span>
          )}
        </div>

        {/* Cookies */}
        <div className="monitor-card">
          <h3>🍪 Cookies ({sessionData.cookies})</h3>
          {sessionData.cookies > 0 ? (
            <span className="badge warning">{sessionData.cookies} cookies activas</span>
          ) : (
            <span className="badge success">✅ Sin cookies</span>
          )}
        </div>

        {/* Usuario */}
        {sessionData.user && (
          <div className="monitor-card">
            <h3>👤 Datos del Usuario</h3>
            <div className="user-data">
              <div><strong>ID:</strong> {sessionData.user.id}</div>
              <div><strong>Nombre:</strong> {sessionData.user.nombre}</div>
              <div><strong>Email:</strong> {sessionData.user.email}</div>
              <div><strong>Rol:</strong> {sessionData.user.rol}</div>
            </div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="monitor-actions">
        <button 
          onClick={handleLogout} 
          className="btn-logout"
          disabled={!sessionData.isAuthenticated}
        >
          🚪 Cerrar Sesión (Limpiar TODO)
        </button>
        
        <button 
          onClick={() => {
            console.log('📊 Estado de sesión:', sessionData);
            console.table({
              'Token presente': !!sessionData.token,
              'Usuario': sessionData.user?.email || 'N/A',
              'localStorage items': sessionData.localStorageKeys.length,
              'sessionStorage items': sessionData.sessionStorageKeys.length,
              'Cookies': sessionData.cookies,
              'Autenticado': sessionData.isAuthenticated
            });
          }}
          className="btn-log"
        >
          📝 Imprimir en Consola
        </button>
      </div>

      {/* Instrucciones */}
      <div className="monitor-instructions">
        <h4>ℹ️ Cómo probar el sistema:</h4>
        <ol>
          <li>Observa el estado actual de tu sesión arriba</li>
          <li>Abre otra pestaña y intenta acceder a <code>/Usuarios</code> sin token</li>
          <li>Ve a la consola del navegador (F12) para ver los logs detallados</li>
          <li>Haz clic en "Cerrar Sesión" para ver la limpieza completa</li>
          <li>Verás notificaciones toast en pantalla durante el proceso</li>
        </ol>
      </div>
    </div>
  );
};

export default SessionMonitor;