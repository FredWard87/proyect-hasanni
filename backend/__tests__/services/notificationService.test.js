// Mock de dependencias ANTES de importar el servicio
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

jest.mock('socket.io', () => {
  return {
    Server: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    }))
  };
});

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

const { Server } = require('socket.io');
const { query } = require('../../config/database');
const jwt = require('jsonwebtoken');

// Ahora importamos el servicio después de mockear
const NotificationService = require('../../services/notificationService');

describe('NotificationService', () => {
  let notificationService;
  let mockIO;
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mocks de Socket.IO
    mockSocket = {
      id: 'test-socket-id',
      userId: null,
      emit: jest.fn(),
      on: jest.fn()
    };

    mockIO = {
      on: jest.fn((event, callback) => {
        if (event === 'connection') {
          // Simular conexión
          callback(mockSocket);
        }
      }),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    Server.mockImplementation(() => mockIO);
    
    // Reiniciar la instancia del servicio
    jest.isolateModules(() => {
      notificationService = require('../../services/notificationService');
    });
    
    // Inicializar propiedades necesarias
    notificationService.connectedUsers = new Map();
    notificationService.io = mockIO;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with server', () => {
      const mockServer = {};

      notificationService.initialize(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:3000",
          methods: ["GET", "POST"]
        }
      });
    });
  });

  describe('Socket Handlers', () => {
    beforeEach(() => {
      notificationService.initialize({});
    });

    test('should handle user authentication successfully', async () => {
      jwt.verify.mockReturnValue({ userId: 1 });
      query.mockResolvedValue({ rows: [] });

      // Simular evento authenticate
      const authenticateHandler = mockSocket.on.mock.calls.find(call => call[0] === 'authenticate');
      if (authenticateHandler) {
        await authenticateHandler[1]('test-token');
      }

      expect(jwt.verify).toHaveBeenCalledWith('test-token', process.env.JWT_SECRET);
      expect(notificationService.connectedUsers.get(1)).toBe('test-socket-id');
    });

    test('should handle mark as read', async () => {
      query.mockResolvedValue({ rows: [] });

      // Simular evento markAsRead
      const markAsReadHandler = mockSocket.on.mock.calls.find(call => call[0] === 'markAsRead');
      if (markAsReadHandler) {
        await markAsReadHandler[1](123);
      }

      expect(query).toHaveBeenCalledWith(
        'UPDATE notificaciones SET leida = true, fecha_leida = NOW() WHERE id = $1',
        [123]
      );
    });
  });

  describe('Notification Creation', () => {
    test('should create notification successfully', async () => {
      const mockNotification = {
        id: 1,
        user_id: 1,
        tipo: 'sistema',
        titulo: 'Test Notification',
        mensaje: 'Test message',
        datos_adicionales: { key: 'value' },
        prioridad: 'normal'
      };

      query.mockResolvedValue({ rows: [mockNotification] });

      // Mock sendRealTimeNotification
      const sendRealTimeSpy = jest.spyOn(notificationService, 'sendRealTimeNotification')
        .mockImplementation(() => {});

      const result = await notificationService.createNotification({
        userId: 1,
        tipo: 'sistema',
        titulo: 'Test Notification',
        mensaje: 'Test message',
        datosAdicionales: { key: 'value' },
        priority: 'normal'
      });

      expect(query).toHaveBeenCalledWith(
        `INSERT INTO notificaciones (user_id, tipo, titulo, mensaje, datos_adicionales, prioridad) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [1, 'sistema', 'Test Notification', 'Test message', '{"key":"value"}', 'normal']
      );
      expect(sendRealTimeSpy).toHaveBeenCalledWith(1, mockNotification);
      expect(result).toEqual(mockNotification);

      sendRealTimeSpy.mockRestore();
    });
  });

  describe('Real-time Notification', () => {
    test('should send real-time notification to connected user', () => {
      notificationService.connectedUsers.set(1, 'test-socket-id');

      const notification = { id: 1, titulo: 'Test', mensaje: 'Test message' };

      notificationService.sendRealTimeNotification(1, notification);

      expect(mockIO.to).toHaveBeenCalledWith('test-socket-id');
      expect(mockIO.emit).toHaveBeenCalledWith('newNotification', notification);
    });
  });

  describe('Pending Notifications', () => {
    test('should send pending notifications to reconnected user', async () => {
      const mockNotifications = [
        { id: 1, titulo: 'Pending 1', leida: false },
        { id: 2, titulo: 'Pending 2', leida: false }
      ];

      query.mockResolvedValue({ rows: mockNotifications });
      notificationService.connectedUsers.set(1, 'test-socket-id');

      await notificationService.sendPendingNotifications(1);

      expect(query).toHaveBeenCalledWith(
        `SELECT * FROM notificaciones 
         WHERE user_id = $1 AND leida = false 
         ORDER BY fecha_creacion DESC LIMIT 10`,
        [1]
      );
      expect(mockIO.to).toHaveBeenCalledWith('test-socket-id');
      expect(mockIO.emit).toHaveBeenCalledWith('pendingNotifications', mockNotifications);
    });
  });

  describe('Broadcast Operations', () => {
    test('should broadcast to multiple users', async () => {
      const createNotificationSpy = jest.spyOn(notificationService, 'createNotification')
        .mockResolvedValue({});

      const userIds = [1, 2, 3];
      const notificationData = {
        tipo: 'sistema',
        titulo: 'Broadcast Test',
        mensaje: 'Test message'
      };

      await notificationService.broadcastToUsers(userIds, notificationData);

      expect(createNotificationSpy).toHaveBeenCalledTimes(3);

      createNotificationSpy.mockRestore();
    });

    test('should broadcast to all users', async () => {
      const mockUsers = [
        { id: 1 }, { id: 2 }, { id: 3 }
      ];

      query.mockResolvedValue({ rows: mockUsers });
      const broadcastToUsersSpy = jest.spyOn(notificationService, 'broadcastToUsers')
        .mockResolvedValue();

      await notificationService.broadcastToAll({
        tipo: 'sistema',
        titulo: 'Global Announcement',
        mensaje: 'Test message'
      });

      expect(query).toHaveBeenCalledWith('SELECT id FROM usuarios WHERE activo = true');
      expect(broadcastToUsersSpy).toHaveBeenCalledWith(
        [1, 2, 3],
        {
          tipo: 'sistema',
          titulo: 'Global Announcement',
          mensaje: 'Test message'
        }
      );

      broadcastToUsersSpy.mockRestore();
    });
  });
});