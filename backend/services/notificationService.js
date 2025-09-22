const { Server } = require('socket.io');
const { query } = require('../config/database');

class NotificationService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupSocketHandlers();
    console.log('🔔 Servicio de notificaciones inicializado');
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Usuario conectado:', socket.id);

      // Autenticar y registrar usuario
      socket.on('authenticate', async (token) => {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          this.connectedUsers.set(decoded.userId, socket.id);
          socket.userId = decoded.userId;
          
          console.log(`✅ Usuario ${decoded.userId} autenticado para notificaciones`);
          
          // Enviar notificaciones pendientes
          await this.sendPendingNotifications(decoded.userId);
        } catch (error) {
          console.error('❌ Error autenticando socket:', error);
          socket.emit('error', { message: 'Token inválido' });
        }
      });

      // Marcar notificación como leída
      socket.on('markAsRead', async (notificationId) => {
        try {
          await query(
            'UPDATE notificaciones SET leida = true, fecha_leida = NOW() WHERE id = $1',
            [notificationId]
          );
          socket.emit('notificationRead', { id: notificationId });
        } catch (error) {
          console.error('Error marcando notificación como leída:', error);
        }
      });

      // Desconexión
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          console.log(`❌ Usuario ${socket.userId} desconectado`);
        }
      });
    });
  }

  // Crear nueva notificación
  async createNotification(notificationData) {
    const {
      userId,
      tipo, // 'sistema', 'seguridad', 'actualizacion', 'admin'
      titulo,
      mensaje,
      datosAdicionales = {},
      priority = 'normal' // 'low', 'normal', 'high', 'urgent'
    } = notificationData;

    try {
      const result = await query(
        `INSERT INTO notificaciones (user_id, tipo, titulo, mensaje, datos_adicionales, prioridad) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, tipo, titulo, mensaje, JSON.stringify(datosAdicionales), priority]
      );

      const notification = result.rows[0];
      
      // Enviar en tiempo real si el usuario está conectado
      this.sendRealTimeNotification(userId, notification);
      
      return notification;
    } catch (error) {
      console.error('Error creando notificación:', error);
      throw error;
    }
  }

  // Enviar notificación en tiempo real
  sendRealTimeNotification(userId, notification) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('newNotification', notification);
      console.log(`📤 Notificación enviada en tiempo real a usuario ${userId}`);
    }
  }

  // Enviar notificaciones pendientes al reconectar
  async sendPendingNotifications(userId) {
    try {
      const result = await query(
        `SELECT * FROM notificaciones 
         WHERE user_id = $1 AND leida = false 
         ORDER BY fecha_creacion DESC LIMIT 10`,
        [userId]
      );

      const socketId = this.connectedUsers.get(userId);
      if (socketId && result.rows.length > 0) {
        this.io.to(socketId).emit('pendingNotifications', result.rows);
        console.log(`📨 ${result.rows.length} notificaciones pendientes enviadas a usuario ${userId}`);
      }
    } catch (error) {
      console.error('Error enviando notificaciones pendientes:', error);
    }
  }

  // Notificación para múltiples usuarios (ej: anuncio global)
  async broadcastToUsers(userIds, notificationData) {
    for (const userId of userIds) {
      await this.createNotification({
        userId,
        ...notificationData
      });
    }
  }

  // Notificación para todos los usuarios (anuncio global)
  async broadcastToAll(notificationData) {
    try {
      const result = await query('SELECT id FROM usuarios WHERE activo = true');
      const userIds = result.rows.map(row => row.id);
      
      await this.broadcastToUsers(userIds, notificationData);
    } catch (error) {
      console.error('Error en broadcast global:', error);
    }
  }

  // Notificación para administradores
  async notifyAdmins(notificationData) {
    try {
      const result = await query('SELECT id FROM usuarios WHERE rol = $1', ['admin']);
      const adminIds = result.rows.map(row => row.id);
      
      await this.broadcastToUsers(adminIds, notificationData);
    } catch (error) {
      console.error('Error notificando administradores:', error);
    }
  }
}

module.exports = new NotificationService();