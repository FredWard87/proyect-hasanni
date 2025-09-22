const { query } = require('../config/database');

// Configuraciones por defecto
const DEFAULT_PREFERENCES = {
  theme: {
    mode: 'light',
    primaryColor: '#1976d2',
    fontSize: 'medium'
  },
  notifications: {
    email: {
      enabled: true,
      marketing: false,
      security: true,
      orders: true,
      newsletter: false
    },
    push: {
      enabled: true,
      sound: true,
      vibration: true,
      locationUpdates: false
    },
    inApp: {
      enabled: true,
      showBadges: true,
      autoHide: 5000
    }
  },
  privacy: {
    profileVisibility: 'private',
    shareLocation: false,
    shareActivity: false,
    dataCollection: true
  },
  ui: {
    language: 'es',
    timezone: 'America/Mexico_City',
    dateFormat: 'DD/MM/YYYY',
    currency: 'USD',
    compactMode: false,
    animationsEnabled: true
  },
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    textSize: 'normal',
    keyboardNavigation: false
  }
};

// Obtener preferencias del usuario
exports.getUserPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'SELECT preferencias FROM usuarios WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const userPreferences = result.rows[0].preferencias || {};
    
    // Combinar preferencias del usuario con valores por defecto
    const mergedPreferences = mergePreferences(DEFAULT_PREFERENCES, userPreferences);

    res.json({
      success: true,
      data: mergedPreferences
    });

  } catch (error) {
    console.error('Error obteniendo preferencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar preferencias del usuario
exports.updateUserPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const newPreferences = req.body;

    // Validar estructura de preferencias
    const validationError = validatePreferences(newPreferences);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    // Obtener preferencias actuales
    const currentResult = await query(
      'SELECT preferencias FROM usuarios WHERE id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const currentPreferences = currentResult.rows[0].preferencias || {};
    
    // Combinar preferencias actuales con las nuevas
    const updatedPreferences = mergePreferences(currentPreferences, newPreferences);

    // Actualizar en base de datos
    const updateResult = await query(
      'UPDATE usuarios SET preferencias = $1 WHERE id = $2 RETURNING nombre, email',
      [JSON.stringify(updatedPreferences), userId]
    );

    console.log(`Preferencias actualizadas para usuario: ${updateResult.rows[0].nombre}`);

    res.json({
      success: true,
      message: 'Preferencias actualizadas correctamente',
      data: updatedPreferences
    });

  } catch (error) {
    console.error('Error actualizando preferencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Resetear preferencias a valores por defecto
exports.resetUserPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'UPDATE usuarios SET preferencias = $1 WHERE id = $2 RETURNING nombre, email',
      [JSON.stringify(DEFAULT_PREFERENCES), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log(`Preferencias reseteadas para usuario: ${result.rows[0].nombre}`);

    res.json({
      success: true,
      message: 'Preferencias reseteadas a valores por defecto',
      data: DEFAULT_PREFERENCES
    });

  } catch (error) {
    console.error('Error reseteando preferencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar preferencia específica
exports.updateSpecificPreference = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { category, key, value } = req.body;

    if (!category || !key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Categoría, clave y valor son requeridos'
      });
    }

    // Obtener preferencias actuales
    const currentResult = await query(
      'SELECT preferencias FROM usuarios WHERE id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const currentPreferences = currentResult.rows[0].preferencias || {};
    
    // Crear copia profunda de las preferencias actuales
    const updatedPreferences = mergePreferences(DEFAULT_PREFERENCES, currentPreferences);
    
    // Actualizar preferencia específica
    if (!updatedPreferences[category]) {
      updatedPreferences[category] = {};
    }
    
    // Manejar preferencias anidadas
    if (key.includes('.')) {
      const keys = key.split('.');
      let currentLevel = updatedPreferences[category];
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!currentLevel[keys[i]]) {
          currentLevel[keys[i]] = {};
        }
        currentLevel = currentLevel[keys[i]];
      }
      
      currentLevel[keys[keys.length - 1]] = value;
    } else {
      updatedPreferences[category][key] = value;
    }

    // Guardar en base de datos
    await query(
      'UPDATE usuarios SET preferencias = $1 WHERE id = $2',
      [JSON.stringify(updatedPreferences), userId]
    );

    res.json({
      success: true,
      message: 'Preferencia actualizada correctamente',
      data: {
        category,
        key,
        value,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error actualizando preferencia específica:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Exportar preferencias del usuario
exports.exportUserPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'SELECT nombre, email, preferencias, fecha_creacion FROM usuarios WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];
    const exportData = {
      user: {
        nombre: user.nombre,
        email: user.email,
        fechaRegistro: user.fecha_creacion
      },
      preferences: user.preferencias || DEFAULT_PREFERENCES,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    res.setHeader('Content-Disposition', `attachment; filename="preferencias-${user.email}-${Date.now()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);

  } catch (error) {
    console.error('Error exportando preferencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función auxiliar para combinar preferencias
function mergePreferences(defaultPrefs, userPrefs) {
  const merged = JSON.parse(JSON.stringify(defaultPrefs));
  
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  
  deepMerge(merged, userPrefs);
  return merged;
}

// Función para validar estructura de preferencias
function validatePreferences(preferences) {
  const allowedCategories = ['theme', 'notifications', 'privacy', 'ui', 'accessibility'];
  
  for (const category in preferences) {
    if (!allowedCategories.includes(category)) {
      return `Categoría no válida: ${category}`;
    }
  }

  // Validaciones específicas
  if (preferences.theme) {
    const { mode, primaryColor, fontSize } = preferences.theme;
    if (mode && !['light', 'dark', 'auto'].includes(mode)) {
      return 'Modo de tema no válido';
    }
    if (fontSize && !['small', 'medium', 'large'].includes(fontSize)) {
      return 'Tamaño de fuente no válido';
    }
  }

  if (preferences.ui) {
    const { language, currency } = preferences.ui;
    if (language && !['es', 'en', 'fr'].includes(language)) {
      return 'Idioma no válido';
    }
    if (currency && !['USD', 'EUR', 'MXN'].includes(currency)) {
      return 'Moneda no válida';
    }
  }

  return null;
}