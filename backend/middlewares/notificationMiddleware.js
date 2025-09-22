const notificationService = require('../services/notificationService');

// Middleware para notificaciones automáticas sobre eventos del sistema
const notificationMiddleware = {
  // Notificar cuando admin modifica datos de usuario
  onUserDataModified: async (adminId, modifiedUserId, changes) => {
    try {
      await notificationService.createNotification({
        userId: modifiedUserId,
        tipo: 'admin',
        titulo: 'Tus datos han sido actualizados',
        mensaje: `Un administrador ha modificado información de tu cuenta.`,
        datosAdicionales: {
          adminId,
          changes,
          timestamp: new Date().toISOString()
        },
        priority: 'high'
      });
    } catch (error) {
      console.error('Error en notificación de modificación:', error);
    }
  },

  // Notificar actividad sospechosa
  onSuspiciousActivity: async (userId, activityDetails) => {
    try {
      await notificationService.createNotification({
        userId,
        tipo: 'seguridad',
        titulo: 'Actividad sospechosa detectada',
        mensaje: `Se detectó una actividad inusual en tu cuenta. Por favor verifica.`,
        datosAdicionales: activityDetails,
        priority: 'urgent'
      });

      // También notificar a administradores
      await notificationService.notifyAdmins({
        tipo: 'seguridad',
        titulo: 'Actividad sospechosa detectada',
        mensaje: `Actividad sospechosa detectada para el usuario ${userId}`,
        datosAdicionales: activityDetails,
        priority: 'high'
      });
    } catch (error) {
      console.error('Error en notificación de seguridad:', error);
    }
  },

  // Notificar sobre actualizaciones del sistema
  onSystemUpdate: async (updateDetails) => {
    try {
      await notificationService.broadcastToAll({
        tipo: 'sistema',
        titulo: 'Actualización del sistema',
        mensaje: updateDetails.message,
        datosAdicionales: updateDetails,
        priority: 'normal'
      });
    } catch (error) {
      console.error('Error en notificación de actualización:', error);
    }
  }
};

module.exports = notificationMiddleware;