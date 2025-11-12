const notificationMiddleware = require('../../middlewares/notificationMiddleware');
const notificationService = require('../../services/notificationService');

// Mock del servicio de notificaciones
jest.mock('../../services/notificationService');

describe('Notification Middleware', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('onUserDataModified', () => {
    it('should create notification when admin modifies user data', async () => {
      const adminId = 1;
      const modifiedUserId = 2;
      const changes = {
        nombre: { old: 'John', new: 'John Doe' },
        email: { old: 'john@test.com', new: 'johndoe@test.com' }
      };

      notificationService.createNotification.mockResolvedValue({
        success: true,
        notificationId: 123
      });

      await notificationMiddleware.onUserDataModified(adminId, modifiedUserId, changes);

      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId: modifiedUserId,
        tipo: 'admin',
        titulo: 'Tus datos han sido actualizados',
        mensaje: 'Un administrador ha modificado información de tu cuenta.',
        datosAdicionales: {
          adminId,
          changes,
          timestamp: expect.any(String)
        },
        priority: 'high'
      });
    });

    it('should include timestamp in notification data', async () => {
      const adminId = 1;
      const modifiedUserId = 2;
      const changes = { rol: { old: 'lector', new: 'editor' } };

      notificationService.createNotification.mockResolvedValue({ success: true });

      await notificationMiddleware.onUserDataModified(adminId, modifiedUserId, changes);

      const callArgs = notificationService.createNotification.mock.calls[0][0];
      expect(callArgs.datosAdicionales.timestamp).toBeDefined();
      expect(new Date(callArgs.datosAdicionales.timestamp)).toBeInstanceOf(Date);
    });

    it('should handle notification service errors gracefully', async () => {
      const adminId = 1;
      const modifiedUserId = 2;
      const changes = { nombre: 'Updated' };

      const error = new Error('Database error');
      notificationService.createNotification.mockRejectedValue(error);

      await notificationMiddleware.onUserDataModified(adminId, modifiedUserId, changes);

      expect(console.error).toHaveBeenCalledWith('Error en notificación de modificación:', error);
    });

    it('should work with empty changes object', async () => {
      const adminId = 1;
      const modifiedUserId = 2;
      const changes = {};

      notificationService.createNotification.mockResolvedValue({ success: true });

      await notificationMiddleware.onUserDataModified(adminId, modifiedUserId, changes);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          datosAdicionales: expect.objectContaining({
            changes: {}
          })
        })
      );
    });

    it('should work with multiple changes', async () => {
      const adminId = 1;
      const modifiedUserId = 2;
      const changes = {
        nombre: { old: 'John', new: 'Jane' },
        email: { old: 'john@test.com', new: 'jane@test.com' },
        rol: { old: 'lector', new: 'editor' },
        telefono: { old: '123456', new: '789012' }
      };

      notificationService.createNotification.mockResolvedValue({ success: true });

      await notificationMiddleware.onUserDataModified(adminId, modifiedUserId, changes);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          datosAdicionales: expect.objectContaining({
            changes
          })
        })
      );
    });

    it('should handle different admin IDs', async () => {
      const changes = { email: 'new@test.com' };

      notificationService.createNotification.mockResolvedValue({ success: true });

      await notificationMiddleware.onUserDataModified(100, 50, changes);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          datosAdicionales: expect.objectContaining({
            adminId: 100
          })
        })
      );
    });
  });

  describe('onSuspiciousActivity', () => {
    it('should notify user about suspicious activity', async () => {
      const userId = 1;
      const activityDetails = {
        type: 'multiple_failed_logins',
        attempts: 5,
        ip: '192.168.1.1',
        timestamp: new Date().toISOString()
      };

      notificationService.createNotification.mockResolvedValue({ success: true });
      notificationService.notifyAdmins.mockResolvedValue({ success: true });

      await notificationMiddleware.onSuspiciousActivity(userId, activityDetails);

      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId,
        tipo: 'seguridad',
        titulo: 'Actividad sospechosa detectada',
        mensaje: 'Se detectó una actividad inusual en tu cuenta. Por favor verifica.',
        datosAdicionales: activityDetails,
        priority: 'urgent'
      });
    });

    it('should notify admins about suspicious activity', async () => {
      const userId = 1;
      const activityDetails = {
        type: 'unauthorized_access',
        location: 'Unknown',
        device: 'Unknown Device'
      };

      notificationService.createNotification.mockResolvedValue({ success: true });
      notificationService.notifyAdmins.mockResolvedValue({ success: true });

      await notificationMiddleware.onSuspiciousActivity(userId, activityDetails);

      expect(notificationService.notifyAdmins).toHaveBeenCalledWith({
        tipo: 'seguridad',
        titulo: 'Actividad sospechosa detectada',
        mensaje: `Actividad sospechosa detectada para el usuario ${userId}`,
        datosAdicionales: activityDetails,
        priority: 'high'
      });
    });

    it('should call both user and admin notifications', async () => {
      const userId = 5;
      const activityDetails = { type: 'brute_force' };

      notificationService.createNotification.mockResolvedValue({ success: true });
      notificationService.notifyAdmins.mockResolvedValue({ success: true });

      await notificationMiddleware.onSuspiciousActivity(userId, activityDetails);

      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.notifyAdmins).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in user notification', async () => {
      const userId = 1;
      const activityDetails = { type: 'suspicious' };

      const error = new Error('User notification failed');
      notificationService.createNotification.mockRejectedValue(error);
      notificationService.notifyAdmins.mockResolvedValue({ success: true });

      await notificationMiddleware.onSuspiciousActivity(userId, activityDetails);

      expect(console.error).toHaveBeenCalledWith('Error en notificación de seguridad:', error);
    });

    it('should handle errors in admin notification', async () => {
      const userId = 1;
      const activityDetails = { type: 'suspicious' };

      notificationService.createNotification.mockResolvedValue({ success: true });
      
      const error = new Error('Admin notification failed');
      notificationService.notifyAdmins.mockRejectedValue(error);

      await notificationMiddleware.onSuspiciousActivity(userId, activityDetails);

      expect(console.error).toHaveBeenCalledWith('Error en notificación de seguridad:', error);
    });

    it('should work with different activity types', async () => {
      const activityTypes = [
        { type: 'password_change_attempt', severity: 'high' },
        { type: 'unusual_location', country: 'Unknown' },
        { type: 'multiple_devices', count: 5 }
      ];

      notificationService.createNotification.mockResolvedValue({ success: true });
      notificationService.notifyAdmins.mockResolvedValue({ success: true });

      for (const activity of activityTypes) {
        await notificationMiddleware.onSuspiciousActivity(1, activity);
      }

      expect(notificationService.createNotification).toHaveBeenCalledTimes(3);
      expect(notificationService.notifyAdmins).toHaveBeenCalledTimes(3);
    });

    it('should pass complete activity details to notifications', async () => {
      const userId = 1;
      const activityDetails = {
        type: 'account_takeover_attempt',
        ip: '10.0.0.1',
        location: 'Russia',
        device: 'Unknown',
        timestamp: '2025-01-01T00:00:00Z',
        metadata: {
          browser: 'Chrome',
          os: 'Windows'
        }
      };

      notificationService.createNotification.mockResolvedValue({ success: true });
      notificationService.notifyAdmins.mockResolvedValue({ success: true });

      await notificationMiddleware.onSuspiciousActivity(userId, activityDetails);

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          datosAdicionales: activityDetails
        })
      );

      expect(notificationService.notifyAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          datosAdicionales: activityDetails
        })
      );
    });
  });

  describe('onSystemUpdate', () => {
    it('should broadcast system update to all users', async () => {
      const updateDetails = {
        message: 'Sistema actualizado a versión 2.0',
        version: '2.0.0',
        features: ['Nueva interfaz', 'Mejoras de rendimiento'],
        timestamp: new Date().toISOString()
      };

      notificationService.broadcastToAll.mockResolvedValue({ success: true });

      await notificationMiddleware.onSystemUpdate(updateDetails);

      expect(notificationService.broadcastToAll).toHaveBeenCalledWith({
        tipo: 'sistema',
        titulo: 'Actualización del sistema',
        mensaje: updateDetails.message,
        datosAdicionales: updateDetails,
        priority: 'normal'
      });
    });

    it('should handle broadcast errors gracefully', async () => {
      const updateDetails = {
        message: 'Mantenimiento programado',
        scheduledTime: '2025-01-15T02:00:00Z'
      };

      const error = new Error('Broadcast failed');
      notificationService.broadcastToAll.mockRejectedValue(error);

      await notificationMiddleware.onSystemUpdate(updateDetails);

      expect(console.error).toHaveBeenCalledWith('Error en notificación de actualización:', error);
    });

    it('should work with minimal update details', async () => {
      const updateDetails = {
        message: 'Sistema en mantenimiento'
      };

      notificationService.broadcastToAll.mockResolvedValue({ success: true });

      await notificationMiddleware.onSystemUpdate(updateDetails);

      expect(notificationService.broadcastToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          mensaje: 'Sistema en mantenimiento'
        })
      );
    });

    it('should work with detailed update information', async () => {
      const updateDetails = {
        message: 'Nueva versión disponible',
        version: '3.0.0',
        releaseNotes: 'Mejoras importantes',
        breaking_changes: false,
        downtime: '5 minutos',
        features: ['Feature 1', 'Feature 2'],
        bugfixes: ['Fix 1', 'Fix 2']
      };

      notificationService.broadcastToAll.mockResolvedValue({ success: true });

      await notificationMiddleware.onSystemUpdate(updateDetails);

      expect(notificationService.broadcastToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          datosAdicionales: updateDetails
        })
      );
    });

    it('should use correct notification type and priority', async () => {
      const updateDetails = { message: 'Test update' };

      notificationService.broadcastToAll.mockResolvedValue({ success: true });

      await notificationMiddleware.onSystemUpdate(updateDetails);

      expect(notificationService.broadcastToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'sistema',
          priority: 'normal'
        })
      );
    });

    it('should handle empty message', async () => {
      const updateDetails = {
        message: '',
        version: '1.0.1'
      };

      notificationService.broadcastToAll.mockResolvedValue({ success: true });

      await notificationMiddleware.onSystemUpdate(updateDetails);

      expect(notificationService.broadcastToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          mensaje: ''
        })
      );
    });

    it('should handle network errors', async () => {
      const updateDetails = { message: 'Update' };

      const networkError = new Error('Network timeout');
      networkError.code = 'ETIMEDOUT';
      notificationService.broadcastToAll.mockRejectedValue(networkError);

      await notificationMiddleware.onSystemUpdate(updateDetails);

      expect(console.error).toHaveBeenCalledWith('Error en notificación de actualización:', networkError);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple notification types in sequence', async () => {
      notificationService.createNotification.mockResolvedValue({ success: true });
      notificationService.notifyAdmins.mockResolvedValue({ success: true });
      notificationService.broadcastToAll.mockResolvedValue({ success: true });

      await notificationMiddleware.onUserDataModified(1, 2, { email: 'new@test.com' });
      await notificationMiddleware.onSuspiciousActivity(3, { type: 'test' });
      await notificationMiddleware.onSystemUpdate({ message: 'Update' });

      expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
      expect(notificationService.notifyAdmins).toHaveBeenCalledTimes(1);
      expect(notificationService.broadcastToAll).toHaveBeenCalledTimes(1);
    });

    it('should maintain independence between notification types', async () => {
      const userError = new Error('User notification failed');
      notificationService.createNotification.mockRejectedValue(userError);
      notificationService.broadcastToAll.mockResolvedValue({ success: true });

      await notificationMiddleware.onUserDataModified(1, 2, {});
      await notificationMiddleware.onSystemUpdate({ message: 'Success' });

      expect(console.error).toHaveBeenCalledWith('Error en notificación de modificación:', userError);
      expect(notificationService.broadcastToAll).toHaveBeenCalled();
    });
  });
});