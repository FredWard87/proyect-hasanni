import React, { useState, useEffect } from 'react';

const UserPreferences = () => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('theme');
  const [message, setMessage] = useState(null);
  const [user, setUser] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [tempPreferences, setTempPreferences] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const tabs = [
    { id: 'theme', name: 'Tema', icon: '🎨' },
    { id: 'notifications', name: 'Notificaciones', icon: '🔔' },
    { id: 'privacy', name: 'Privacidad', icon: '🔒' },
    { id: 'ui', name: 'Interfaz', icon: '⚙️' },
    { id: 'accessibility', name: 'Accesibilidad', icon: '♿' }
  ];

  useEffect(() => {
    loadUser();
    loadPreferences();
  }, []);

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/preferencias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
        setTempPreferences(data.data);
        // Aplicar tema al cargar
        applyTheme(data.data.theme);
      } else {
        setMessage({ type: 'error', text: 'Error cargando preferencias' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  const saveAllChanges = async () => {
    if (!unsavedChanges) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/preferencias`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(tempPreferences)
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
        setTempPreferences(data.data);
        setUnsavedChanges(false);
        setMessage({ type: 'success', text: 'Preferencias guardadas correctamente' });
        
        // Aplicar tema inmediatamente
        applyTheme(data.data.theme);
        
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Error guardando preferencias' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  };

  const updateSpecificPreference = async (category, key, value) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/preferencias/specific`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ category, key, value })
      });

      if (response.ok) {
        // Actualizar estado local
        setPreferences(prev => ({
          ...prev,
          [category]: {
            ...prev[category],
            [key]: value
          }
        }));
        setTempPreferences(prev => ({
          ...prev,
          [category]: {
            ...prev[category],
            [key]: value
          }
        }));
      }
    } catch (error) {
      console.error('Error actualizando preferencia:', error);
    }
  };

  const handlePreferenceChange = (category, key, value) => {
    setTempPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setUnsavedChanges(true);
    
    // Aplicar cambios de tema inmediatamente (visual)
    if (category === 'theme') {
      applyTheme({ ...tempPreferences.theme, [key]: value });
    }
  };

  const handleNestedPreferenceChange = (category, subcategory, key, value) => {
    setTempPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [subcategory]: {
          ...prev[category][subcategory],
          [key]: value
        }
      }
    }));
    setUnsavedChanges(true);
  };

  const cancelChanges = () => {
    setTempPreferences(preferences);
    setUnsavedChanges(false);
    // Restaurar tema original
    applyTheme(preferences.theme);
    setMessage({ type: 'info', text: 'Cambios cancelados' });
    setTimeout(() => setMessage(null), 3000);
  };

  const resetPreferences = async () => {
    if (!window.confirm('¿Estás seguro de restaurar todas las preferencias por defecto?')) {
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/preferencias/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
        setTempPreferences(data.data);
        setUnsavedChanges(false);
        applyTheme(data.data.theme);
        setMessage({ type: 'success', text: 'Preferencias restauradas por defecto' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Error restaurando preferencias' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error restaurando preferencias' });
    } finally {
      setSaving(false);
    }
  };

  const exportPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/preferencias/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `preferencias-${user?.email || 'usuario'}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Preferencias exportadas correctamente' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error exportando preferencias' });
    }
  };

  const applyTheme = (theme) => {
    const root = document.documentElement;
    
    // Aplicar modo de tema
    if (theme.mode === 'dark') {
      root.setAttribute('data-theme', 'dark');
      document.body.style.backgroundColor = '#121212';
      document.body.style.color = '#ffffff';
    } else {
      root.setAttribute('data-theme', 'light');
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#000000';
    }

    // Aplicar color primario
    if (theme.primaryColor) {
      root.style.setProperty('--primary-color', theme.primaryColor);
    }
    
    // Aplicar tamaño de fuente - CORREGIDO
    if (theme.fontSize) {
      const fontSizes = { 
        small: '14px', 
        medium: '16px', 
        large: '18px' 
      };
      const fontSize = fontSizes[theme.fontSize] || '16px';
      root.style.setProperty('--base-font-size', fontSize);
      document.body.style.fontSize = fontSize;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div>Cargando preferencias...</div>
      </div>
    );
  }

  if (!tempPreferences) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>Error cargando preferencias</div>
        <button onClick={loadPreferences} style={{ marginTop: '10px', padding: '10px' }}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1>Preferencias de Usuario</h1>
        {user && (
          <p style={{ color: '#666', margin: '10px 0' }}>
            Personaliza tu experiencia, {user.nombre}
          </p>
        )}
      </div>

      {/* Mensajes */}
      {message && (
        <div style={{
          padding: '10px 15px',
          marginBottom: '20px',
          borderRadius: '5px',
          backgroundColor: message.type === 'success' ? '#d4edda' : 
                          message.type === 'error' ? '#f8d7da' : '#d1ecf1',
          color: message.type === 'success' ? '#155724' : 
                message.type === 'error' ? '#721c24' : '#0c5460',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : 
                            message.type === 'error' ? '#f5c6cb' : '#bee5eb'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ marginBottom: '30px' }}>
        <nav style={{ display: 'flex', gap: '5px', borderBottom: '1px solid #ddd', flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                backgroundColor: activeTab === tab.id ? '#007bff' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#666',
                border: 'none',
                borderRadius: '5px 5px 0 0',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '5px'
              }}
            >
              <span>{tab.icon}</span>
              {tab.name}
              {unsavedChanges && activeTab === tab.id && ' •'}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Panels */}
      <div style={{ minHeight: '400px' }}>
        {activeTab === 'theme' && (
          <div>
            <h3>Configuración de Tema {unsavedChanges && "•"}</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Modo de tema:
              </label>
              <select
                value={tempPreferences.theme.mode}
                onChange={(e) => handlePreferenceChange('theme', 'mode', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
              >
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
                <option value="auto">Automático</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Color primario:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color"
                  value={tempPreferences.theme.primaryColor}
                  onChange={(e) => handlePreferenceChange('theme', 'primaryColor', e.target.value)}
                  style={{ width: '50px', height: '40px', border: 'none', borderRadius: '4px' }}
                />
                <span>{tempPreferences.theme.primaryColor}</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Tamaño de fuente:
              </label>
              <select
                value={tempPreferences.theme.fontSize}
                onChange={(e) => handlePreferenceChange('theme', 'fontSize', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
              >
                <option value="small">Pequeño (14px)</option>
                <option value="medium">Mediano (16px)</option>
                <option value="large">Grande (18px)</option>
              </select>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Tamaño actual: {tempPreferences.theme.fontSize}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <h3>Configuración de Notificaciones {unsavedChanges && "•"}</h3>
            
            <div style={{ marginBottom: '30px' }}>
              <h4>Notificaciones por Email</h4>
              <div style={{ marginLeft: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.email.enabled}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'email', 'enabled', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Habilitar notificaciones por email
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.email.security}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'email', 'security', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Alertas de seguridad
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.email.orders}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'email', 'orders', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Confirmaciones de pedidos
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.email.marketing}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'email', 'marketing', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Ofertas y promociones
                </label>

                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.email.newsletter}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'email', 'newsletter', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Newsletter mensual
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <h4>Notificaciones Push</h4>
              <div style={{ marginLeft: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.push.enabled}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'push', 'enabled', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Habilitar notificaciones push
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.push.sound}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'push', 'sound', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Sonido en notificaciones
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.push.vibration}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'push', 'vibration', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Vibración
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.push.locationUpdates}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'push', 'locationUpdates', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Actualizaciones de ubicación
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <h4>Notificaciones en la Aplicación</h4>
              <div style={{ marginLeft: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.inApp.enabled}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'inApp', 'enabled', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Habilitar notificaciones en la app
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={tempPreferences.notifications.inApp.showBadges}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'inApp', 'showBadges', e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Mostrar badges/contadores
                </label>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Tiempo de auto-ocultar (ms):
                  </label>
                  <input
                    type="number"
                    value={tempPreferences.notifications.inApp.autoHide}
                    onChange={(e) => handleNestedPreferenceChange('notifications', 'inApp', 'autoHide', parseInt(e.target.value) || 5000)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
                    min="1000"
                    max="10000"
                    step="1000"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div>
            <h3>Configuración de Privacidad {unsavedChanges && "•"}</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Visibilidad del perfil:
              </label>
              <select
                value={tempPreferences.privacy.profileVisibility}
                onChange={(e) => handlePreferenceChange('privacy', 'profileVisibility', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
              >
                <option value="public">Público</option>
                <option value="private">Privado</option>
                <option value="friends">Solo amigos</option>
              </select>
            </div>

            <div style={{ marginLeft: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.privacy.shareLocation}
                  onChange={(e) => handlePreferenceChange('privacy', 'shareLocation', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Compartir ubicación
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.privacy.shareActivity}
                  onChange={(e) => handlePreferenceChange('privacy', 'shareActivity', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Compartir actividad
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.privacy.dataCollection}
                  onChange={(e) => handlePreferenceChange('privacy', 'dataCollection', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Permitir recolección de datos para mejorar el servicio
              </label>
            </div>
          </div>
        )}

        {activeTab === 'ui' && (
          <div>
            <h3>Configuración de Interfaz {unsavedChanges && "•"}</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Idioma:
              </label>
              <select
                value={tempPreferences.ui.language}
                onChange={(e) => handlePreferenceChange('ui', 'language', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Zona horaria:
              </label>
              <select
                value={tempPreferences.ui.timezone}
                onChange={(e) => handlePreferenceChange('ui', 'timezone', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
              >
                <option value="America/Mexico_City">Ciudad de México</option>
                <option value="America/New_York">New York</option>
                <option value="Europe/Madrid">Madrid</option>
                <option value="America/Los_Angeles">Los Angeles</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Formato de fecha:
              </label>
              <select
                value={tempPreferences.ui.dateFormat}
                onChange={(e) => handlePreferenceChange('ui', 'dateFormat', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
              >
                <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                <option value="MM/DD/YYYY">MM/DD/AAAA</option>
                <option value="YYYY-MM-DD">AAAA-MM-DD</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Moneda:
              </label>
              <select
                value={tempPreferences.ui.currency}
                onChange={(e) => handlePreferenceChange('ui', 'currency', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="MXN">MXN ($)</option>
              </select>
            </div>

            <div style={{ marginLeft: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.ui.compactMode}
                  onChange={(e) => handlePreferenceChange('ui', 'compactMode', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Modo compacto
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.ui.animationsEnabled}
                  onChange={(e) => handlePreferenceChange('ui', 'animationsEnabled', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Animaciones habilitadas
              </label>
            </div>
          </div>
        )}

        {activeTab === 'accessibility' && (
          <div>
            <h3>Configuración de Accesibilidad {unsavedChanges && "•"}</h3>
            
            <div style={{ marginLeft: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.accessibility.highContrast}
                  onChange={(e) => handlePreferenceChange('accessibility', 'highContrast', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Alto contraste
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.accessibility.reducedMotion}
                  onChange={(e) => handlePreferenceChange('accessibility', 'reducedMotion', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Reducir movimiento
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.accessibility.screenReader}
                  onChange={(e) => handlePreferenceChange('accessibility', 'screenReader', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Compatibilidad con lectores de pantalla
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={tempPreferences.accessibility.keyboardNavigation}
                  onChange={(e) => handlePreferenceChange('accessibility', 'keyboardNavigation', e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                Navegación por teclado
              </label>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Tamaño de texto:
              </label>
              <select
                value={tempPreferences.accessibility.textSize}
                onChange={(e) => handlePreferenceChange('accessibility', 'textSize', e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
              >
                <option value="small">Pequeño</option>
                <option value="normal">Normal</option>
                <option value="large">Grande</option>
                <option value="xlarge">Extra Grande</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: '40px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {unsavedChanges && (
          <button
            onClick={cancelChanges}
            disabled={saving}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            Cancelar
          </button>
        )}
        
        <button
          onClick={saveAllChanges}
          disabled={saving || !unsavedChanges}
          style={{
            padding: '10px 20px',
            backgroundColor: unsavedChanges ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (saving || !unsavedChanges) ? 'not-allowed' : 'pointer',
            opacity: (saving || !unsavedChanges) ? 0.6 : 1
          }}
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
        
        <button
          onClick={resetPreferences}
          disabled={saving}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          Restaurar por Defecto
        </button>
        
        <button
          onClick={exportPreferences}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Exportar
        </button>
      </div>
    </div>
  );
};

export default UserPreferences;