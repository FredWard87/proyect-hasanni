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
  const [preferences, setPreferences] = useState(null);
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

  const loadPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/preferencias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
        applyTheme(data.data.theme);
        applyAccessibility(data.data.accessibility);
        applyLanguage(data.data.ui.language);
      }
    } catch (error) {
      console.error('Error cargando preferencias:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPreferences) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/preferencias`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newPreferences)
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
        applyTheme(data.data.theme);
        applyAccessibility(data.data.accessibility);
        applyLanguage(data.data.ui.language);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error actualizando preferencias:', error);
      return false;
    }
  };

  // Aplicar tema globalmente
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
    
    // Aplicar tamaño de fuente
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

  // Aplicar accesibilidad globalmente
  const applyAccessibility = (accessibility) => {
    const root = document.documentElement;
    
    // Alto contraste
    if (accessibility.highContrast) {
      root.style.setProperty('--contrast-multiplier', '1.5');
      document.body.classList.add('high-contrast');
    } else {
      root.style.setProperty('--contrast-multiplier', '1');
      document.body.classList.remove('high-contrast');
    }

    // Reducir movimiento
    if (accessibility.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }

    // Tamaño de texto de accesibilidad
    if (accessibility.textSize) {
      const textSizes = {
        small: '0.875rem',
        normal: '1rem',
        large: '1.125rem',
        xlarge: '1.25rem'
      };
      root.style.setProperty('--accessibility-text-size', textSizes[accessibility.textSize] || '1rem');
    }
  };

  // Aplicar idioma globalmente
  const applyLanguage = (language) => {
    document.documentElement.lang = language;
    // Aquí podrías integrar con i18n si usas biblioteca de internacionalización
  };

  const value = {
    preferences,
    loading,
    user,
    loadPreferences,
    updatePreferences,
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