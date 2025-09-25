const { query } = require('../config/database');

// Configuraciones por defecto (actualizada según tu OpenAPI)
const DEFAULT_PREFERENCES = {
  theme: "light",
  language: "es",
  notifications: {
    email: true,
    push: false,
    sms: false
  },
  privacy: {
    showLocation: false,
    showOnlineStatus: true,
    allowContactByEmail: true
  },
  dashboard: {
    layout: "grid",
    itemsPerPage: 20
  }
};

// Obtener preferencias del usuario
exports.getUserPreferences = async (req, res) => {
  try {
    console.log('🔍 === GET USER PREFERENCES ===');
    console.log('👤 User object:', req.user);
    
    const userId = req.user.userId;

    // Validar que userId sea un número válido
    if (!userId || isNaN(userId)) {
      console.log('❌ ID de usuario inválido:', userId);
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    console.log('🔍 Buscando usuario ID:', userId);

    const result = await query(
      'SELECT id, nombre, email, preferencias FROM usuarios WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado para ID:', userId);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];
    console.log('✅ Usuario encontrado:', user.nombre);
    console.log('📊 Preferencias actuales:', user.preferencias);

    // Combinar preferencias del usuario con valores por defecto
    const userPreferences = user.preferencias || {};
    const mergedPreferences = mergePreferences(DEFAULT_PREFERENCES, userPreferences);

    console.log('🎯 Preferencias finales:', mergedPreferences);

    res.json({
      success: true,
      data: mergedPreferences
    });

  } catch (error) {
    console.error('💥 Error obteniendo preferencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar preferencias del usuario
exports.updateUserPreferences = async (req, res) => {
  try {
    console.log('🔄 === UPDATE USER PREFERENCES ===');
    console.log('👤 User object:', req.user);
    console.log('📝 New preferences:', req.body);

    const userId = req.user.userId;
    const newPreferences = req.body;

    // Validar que userId sea un número válido
    if (!userId || isNaN(userId)) {
      console.log('❌ ID de usuario inválido:', userId);
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    // Validar estructura de preferencias
    const validationError = validatePreferences(newPreferences);
    if (validationError) {
      console.log('❌ Error de validación:', validationError);
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    console.log('🔍 Buscando usuario ID:', userId);

    // Obtener preferencias actuales
    const currentResult = await query(
      'SELECT id, nombre, preferencias FROM usuarios WHERE id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      console.log('❌ Usuario no encontrado para ID:', userId);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const currentPreferences = currentResult.rows[0].preferencias || {};
    console.log('📊 Preferencias actuales:', currentPreferences);
    
    // Combinar preferencias actuales con las nuevas
    const updatedPreferences = mergePreferences(currentPreferences, newPreferences);
    console.log('🔄 Preferencias actualizadas:', updatedPreferences);

    // Actualizar en base de datos
    const updateResult = await query(
      'UPDATE usuarios SET preferencias = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nombre, email, preferencias',
      [JSON.stringify(updatedPreferences), userId]
    );

    console.log('✅ Preferencias actualizadas para usuario:', updateResult.rows[0].nombre);

    res.json({
      success: true,
      message: 'Preferencias actualizadas correctamente',
      data: updatedPreferences
    });

  } catch (error) {
    console.error('💥 Error actualizando preferencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Resetear preferencias a valores por defecto
exports.resetUserPreferences = async (req, res) => {
  try {
    console.log('🔄 === RESET USER PREFERENCES ===');
    console.log('👤 User object:', req.user);

    const userId = req.user.userId;

    // Validar que userId sea un número válido
    if (!userId || isNaN(userId)) {
      console.log('❌ ID de usuario inválido:', userId);
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    console.log('🔍 Buscando usuario ID:', userId);

    const result = await query(
      'UPDATE usuarios SET preferencias = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nombre, email',
      [JSON.stringify(DEFAULT_PREFERENCES), userId]
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado para ID:', userId);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log('✅ Preferencias reseteadas para usuario:', result.rows[0].nombre);

    res.json({
      success: true,
      message: 'Preferencias reseteadas a valores por defecto',
      data: DEFAULT_PREFERENCES
    });

  } catch (error) {
    console.error('💥 Error reseteando preferencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar preferencia específica
exports.updateSpecificPreference = async (req, res) => {
  try {
    console.log('🎯 === UPDATE SPECIFIC PREFERENCE ===');
    console.log('👤 User object:', req.user);
    console.log('📝 Request body:', req.body);

    const userId = req.user.userId;
    const { category, key, value } = req.body;

    // Validar que userId sea un número válido
    if (!userId || isNaN(userId)) {
      console.log('❌ ID de usuario inválido:', userId);
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    if (!category || !key || value === undefined) {
      console.log('❌ Datos incompletos:', { category, key, value });
      return res.status(400).json({
        success: false,
        message: 'Categoría, clave y valor son requeridos'
      });
    }

    console.log('🔍 Buscando usuario ID:', userId);

    // Obtener preferencias actuales
    const currentResult = await query(
      'SELECT preferencias FROM usuarios WHERE id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      console.log('❌ Usuario no encontrado para ID:', userId);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const currentPreferences = currentResult.rows[0].preferencias || {};
    console.log('📊 Preferencias actuales:', currentPreferences);
    
    // Crear copia profunda de las preferencias actuales
    const updatedPreferences = mergePreferences(DEFAULT_PREFERENCES, currentPreferences);
    
    // Actualizar preferencia específica
    if (!updatedPreferences[category]) {
      updatedPreferences[category] = {};
    }
    
    // Manejar preferencias anidadas (como notifications.email)
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

    console.log('🔄 Preferencias actualizadas:', updatedPreferences);

    // Guardar en base de datos
    await query(
      'UPDATE usuarios SET preferencias = $1, updated_at = NOW() WHERE id = $2',
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
    console.error('💥 Error actualizando preferencia específica:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Exportar preferencias del usuario
exports.exportUserPreferences = async (req, res) => {
  try {
    console.log('📤 === EXPORT USER PREFERENCES ===');
    console.log('👤 User object:', req.user);

    const userId = req.user.userId;

    // Validar que userId sea un número válido
    if (!userId || isNaN(userId)) {
      console.log('❌ ID de usuario inválido:', userId);
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    console.log('🔍 Buscando usuario ID:', userId);

    const result = await query(
      'SELECT nombre, email, preferencias, fecha_creacion FROM usuarios WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado para ID:', userId);
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

    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="preferencias-${user.email}-${Date.now()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    
    res.json({
      success: true,
      data: exportData,
      message: 'Preferencias exportadas exitosamente'
    });

  } catch (error) {
    console.error('💥 Error exportando preferencias:', error);
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

// Función para validar estructura de preferencias (actualizada según tu OpenAPI)
function validatePreferences(preferences) {
  const allowedCategories = ['theme', 'language', 'notifications', 'privacy', 'dashboard'];
  
  for (const category in preferences) {
    if (!allowedCategories.includes(category)) {
      return `Categoría no válida: ${category}. Categorías permitidas: ${allowedCategories.join(', ')}`;
    }
  }

  // Validaciones específicas según tu OpenAPI
  if (preferences.theme && !['light', 'dark', 'auto'].includes(preferences.theme)) {
    return 'Tema no válido. Valores permitidos: light, dark, auto';
  }

  if (preferences.language && !['es', 'en', 'fr'].includes(preferences.language)) {
    return 'Idioma no válido. Valores permitidos: es, en, fr';
  }

  if (preferences.notifications) {
    const { email, push, sms } = preferences.notifications;
    if (email !== undefined && typeof email !== 'boolean') {
      return 'Notifications.email debe ser un valor booleano';
    }
    if (push !== undefined && typeof push !== 'boolean') {
      return 'Notifications.push debe ser un valor booleano';
    }
    if (sms !== undefined && typeof sms !== 'boolean') {
      return 'Notifications.sms debe ser un valor booleano';
    }
  }

  if (preferences.privacy) {
    const { showLocation, showOnlineStatus, allowContactByEmail } = preferences.privacy;
    if (showLocation !== undefined && typeof showLocation !== 'boolean') {
      return 'Privacy.showLocation debe ser un valor booleano';
    }
    if (showOnlineStatus !== undefined && typeof showOnlineStatus !== 'boolean') {
      return 'Privacy.showOnlineStatus debe ser un valor booleano';
    }
    if (allowContactByEmail !== undefined && typeof allowContactByEmail !== 'boolean') {
      return 'Privacy.allowContactByEmail debe ser un valor booleano';
    }
  }

  if (preferences.dashboard) {
    const { layout, itemsPerPage } = preferences.dashboard;
    if (layout && !['grid', 'list', 'cards'].includes(layout)) {
      return 'Dashboard.layout no válido. Valores permitidos: grid, list, cards';
    }
    if (itemsPerPage && (typeof itemsPerPage !== 'number' || itemsPerPage < 5 || itemsPerPage > 100)) {
      return 'Dashboard.itemsPerPage debe ser un número entre 5 y 100';
    }
  }

  return null;
}