const nodemailer = require('nodemailer');

// Mock de nodemailer ANTES de importar el servicio
jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

// Ahora importamos el servicio después de mockear
const EmailService = require('../../services/emailService');

describe('EmailService', () => {
  let emailService;
  let mockTransporter;
  let mockCreateTransport;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock transporter
    mockTransporter = {
      sendMail: jest.fn()
    };
    
    // Mock createTransport
    mockCreateTransport = nodemailer.createTransport;
    mockCreateTransport.mockReturnValue(mockTransporter);
    
    // Mock environment variables
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASS = 'testpass';
    
    // Reiniciar la instancia del servicio
    jest.isolateModules(() => {
      emailService = require('../../services/emailService');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create transporter with correct configuration', () => {
      // El constructor se ejecuta cuando se importa el módulo
      expect(mockCreateTransport).toHaveBeenCalledWith({
        service: 'gmail',
        auth: {
          user: 'test@example.com',
          pass: 'testpass'
        }
      });
    });
  });

  describe('sendEmail', () => {
    test('should send email successfully', async () => {
      const mockResult = {
        messageId: 'test-message-id',
        response: '250 OK',
        accepted: ['recipient@example.com']
      };

      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const to = 'recipient@example.com';
      const subject = 'Test Subject';
      const html = '<p>Test HTML content</p>';

      const result = await emailService.sendEmail(to, subject, html);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>'
      });

      expect(result).toEqual(mockResult);
    });

    test('should handle email sending errors', async () => {
      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      const to = 'recipient@example.com';
      const subject = 'Test Subject';
      const html = '<p>Test HTML content</p>';

      await expect(emailService.sendEmail(to, subject, html))
        .rejects.toThrow('SMTP connection failed');

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendStockAlert', () => {
    test('should send stock alert email with correct format', async () => {
      // Mock sendEmail para evitar dependencias reales
      const originalSendEmail = emailService.sendEmail;
      emailService.sendEmail = jest.fn().mockResolvedValue({ 
        success: true, 
        messageId: 'alert-123' 
      });

      const lowStockProducts = [
        {
          codigo: 'PROD001',
          nombre: 'Producto Crítico',
          stock_actual: 2,
          stock_minimo: 10,
          cantidad_vendida: 5
        },
        {
          codigo: 'PROD002',
          nombre: 'Producto Alerta',
          stock_actual: 8,
          stock_minimo: 15,
          cantidad_vendida: 3
        }
      ];

      const to = 'admin@example.com';

      const result = await emailService.sendStockAlert(to, lowStockProducts);

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        to,
        expect.stringContaining('Alerta: Productos con Stock Bajo'),
        expect.stringContaining('Producto Crítico')
      );

      // Restaurar método original
      emailService.sendEmail = originalSendEmail;
    });

    test('should handle empty products array', async () => {
      // Mock sendEmail
      const originalSendEmail = emailService.sendEmail;
      emailService.sendEmail = jest.fn().mockResolvedValue({ 
        success: true 
      });

      await emailService.sendStockAlert('test@example.com', []);

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Alerta: Productos con Stock Bajo'),
        expect.any(String)
      );

      // Restaurar método original
      emailService.sendEmail = originalSendEmail;
    });
  });

  describe('Error Handling', () => {
    test('should log error when email fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = new Error('Network error');
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(emailService.sendEmail('test@example.com', 'Test', '<p>Test</p>'))
        .rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Error enviando email:', error);
      
      consoleSpy.mockRestore();
    });

    test('should log success when email sent', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'success-123' });

      await emailService.sendEmail('test@example.com', 'Test', '<p>Test</p>');

      expect(consoleSpy).toHaveBeenCalledWith('Email enviado exitosamente:', 'success-123');
      
      consoleSpy.mockRestore();
    });
  });
});