import React, { createContext, useContext, useState, useEffect } from 'react';

const PreferencesContext = createContext();

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences debe usarse dentro de PreferencesProvider');
  }
  return context;
};

export const PreferencesProvider = ({ children }) => {
  const [preferences, setPreferences] = useState({
    theme: {
      mode: 'light',
      primaryColor: '#1976d2',
      fontSize: 'medium'
    },
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      textSize: 'normal'
    },
    ui: {
      language: 'es',
      sidebarCollapsed: false,
      denseMode: false
    },
    notifications: {
      email: true,
      push: true,
      sounds: true
    }
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Cargar preferencias al iniciar
  useEffect(() => {
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

  // Función para cargar preferencias con manejo robusto de errores
  const loadPreferences = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        // Si no hay token, cargar preferencias por defecto
        loadDefaultPreferences();
        return;
      }

      // Intentar cargar desde el backend
      const response = await fetch(`${API_URL}/preferencias`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          // Fusionar las preferencias cargadas con las por defecto
          const mergedPreferences = mergePreferences(data.data);
          setPreferences(mergedPreferences);
          applyAllPreferences(mergedPreferences);
        } else {
          loadDefaultPreferences();
        }
      } else {
        // Si falla el backend, cargar desde localStorage
        loadFromLocalStorage();
      }
    } catch (error) {
      console.error('Error cargando preferencias:', error);
      // En caso de error, cargar desde localStorage
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Cargar preferencias por defecto
  const loadDefaultPreferences = () => {
    const defaultPreferences = {
      theme: {
        mode: 'light',
        primaryColor: '#1976d2',
        fontSize: 'medium'
      },
      accessibility: {
        highContrast: false,
        reducedMotion: false,
        textSize: 'normal'
      },
      ui: {
        language: 'es',
        sidebarCollapsed: false,
        denseMode: false
      },
      notifications: {
        email: true,
        push: true,
        sounds: true
      }
    };
    
    setPreferences(defaultPreferences);
    applyAllPreferences(defaultPreferences);
    saveToLocalStorage(defaultPreferences);
  };

  // Cargar desde localStorage
  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('userPreferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        const mergedPreferences = mergePreferences(parsed);
        setPreferences(mergedPreferences);
        applyAllPreferences(mergedPreferences);
      } else {
        loadDefaultPreferences();
      }
    } catch (error) {
      console.error('Error cargando preferencias de localStorage:', error);
      loadDefaultPreferences();
    }
  };

  // Guardar en localStorage
  const saveToLocalStorage = (prefs) => {
    try {
      localStorage.setItem('userPreferences', JSON.stringify(prefs));
    } catch (error) {
      console.error('Error guardando preferencias en localStorage:', error);
    }
  };

  // Fusionar preferencias (nuevas con por defecto)
  const mergePreferences = (newPreferences) => {
    const defaultPreferences = {
      theme: {
        mode: 'light',
        primaryColor: '#1976d2',
        fontSize: 'medium'
      },
      accessibility: {
        highContrast: false,
        reducedMotion: false,
        textSize: 'normal'
      },
      ui: {
        language: 'es',
        sidebarCollapsed: false,
        denseMode: false
      },
      notifications: {
        email: true,
        push: true,
        sounds: true
      }
    };

    // Fusión profunda
    return {
      theme: { ...defaultPreferences.theme, ...(newPreferences.theme || {}) },
      accessibility: { 
        ...defaultPreferences.accessibility, 
        ...(newPreferences.accessibility || {}),
        // Asegurar que highContrast tenga un valor booleano
        highContrast: Boolean(newPreferences.accessibility?.highContrast)
      },
      ui: { ...defaultPreferences.ui, ...(newPreferences.ui || {}) },
      notifications: { ...defaultPreferences.notifications, ...(newPreferences.notifications || {}) }
    };
  };

  // Aplicar todas las preferencias
  const applyAllPreferences = (prefs) => {
    applyTheme(prefs.theme);
    applyAccessibility(prefs.accessibility);
    applyLanguage(prefs.ui.language);
  };

  // Actualizar preferencias
  const updatePreferences = async (newPreferences) => {
    try {
      const mergedPreferences = mergePreferences(newPreferences);
      
      // Actualizar estado local inmediatamente
      setPreferences(mergedPreferences);
      applyAllPreferences(mergedPreferences);
      saveToLocalStorage(mergedPreferences);

      // Intentar guardar en el backend si hay usuario autenticado
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch(`${API_URL}/preferencias`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(mergedPreferences)
        });

        if (!response.ok) {
          console.warn('No se pudo guardar en el backend, pero se guardó localmente');
        }
      }

      return true;
    } catch (error) {
      console.error('Error actualizando preferencias:', error);
      return false;
    }
  };

  // Aplicar tema globalmente
  const applyTheme = (theme) => {
    if (!theme) return;
    
    const root = document.documentElement;
    
    // Aplicar modo de tema con valores por defecto
    const themeMode = theme.mode || 'light';
    if (themeMode === 'dark') {
      root.setAttribute('data-theme', 'dark');
      document.body.style.backgroundColor = '#121212';
      document.body.style.color = '#ffffff';
    } else {
      root.setAttribute('data-theme', 'light');
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#000000';
    }

    // Aplicar color primario con valor por defecto
    const primaryColor = theme.primaryColor || '#1976d2';
    root.style.setProperty('--primary-color', primaryColor);
    
    // Aplicar tamaño de fuente con valor por defecto
    const fontSize = theme.fontSize || 'medium';
    const fontSizes = { 
      small: '14px', 
      medium: '16px', 
      large: '18px' 
    };
    const fontSizeValue = fontSizes[fontSize] || '16px';
    root.style.setProperty('--base-font-size', fontSizeValue);
    document.body.style.fontSize = fontSizeValue;
  };

  // Aplicar accesibilidad globalmente CON MANEJO SEGURO
  const applyAccessibility = (accessibility) => {
    if (!accessibility) return;
    
    const root = document.documentElement;
    
    // Alto contraste con valor por defecto seguro
    const highContrast = Boolean(accessibility.highContrast);
    if (highContrast) {
      root.style.setProperty('--contrast-multiplier', '1.5');
      document.body.classList.add('high-contrast');
    } else {
      root.style.setProperty('--contrast-multiplier', '1');
      document.body.classList.remove('high-contrast');
    }

    // Reducir movimiento con valor por defecto
    const reducedMotion = Boolean(accessibility.reducedMotion);
    if (reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }

    // Tamaño de texto de accesibilidad con valor por defecto
    const textSize = accessibility.textSize || 'normal';
    const textSizes = {
      small: '0.875rem',
      normal: '1rem',
      large: '1.125rem',
      xlarge: '1.25rem'
    };
    root.style.setProperty('--accessibility-text-size', textSizes[textSize] || '1rem');
  };

  // Aplicar idioma globalmente
  const applyLanguage = (language) => {
    const lang = language || 'es';
    document.documentElement.lang = lang;
  };

  // Función para resetear preferencias
  const resetPreferences = async () => {
    return await updatePreferences({});
  };

  // Función para actualizar una sección específica
  const updatePreferenceSection = async (section, data) => {
    const updatedPreferences = {
      ...preferences,
      [section]: { ...preferences[section], ...data }
    };
    return await updatePreferences(updatedPreferences);
  };

  const value = {
    preferences,
    loading,
    user,
    loadPreferences,
    updatePreferences,
    updatePreferenceSection,
    resetPreferences,
    applyTheme,
    applyAccessibility,
    applyLanguage
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

export default PreferencesContext;