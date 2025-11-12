const Usuario = require('../../models/Usuario');
const bcrypt = require('bcryptjs');
const { query } = require('../../config/database');

// Mocks
jest.mock('bcryptjs');
jest.mock('../../config/database');

describe('Usuario Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    process.env.SALT_ROUNDS = '12';
  });

  describe('Constructor', () => {
    it('should create usuario with all parameters', () => {
      const usuario = new Usuario(
        1, 'John Doe', 'john@test.com', 'password123', 'admin',
        'otp123', new Date(), 'google', 'pin_hash', new Date(), true, 0, null
      );

      expect(usuario.id).toBe(1);
      expect(usuario.nombre).toBe('John Doe');
      expect(usuario.email).toBe('john@test.com');
      expect(usuario.rol).toBe('admin');
      expect(usuario.biometric_enabled).toBe(true);
    });

    it('should create usuario with default values', () => {
      const usuario = new Usuario();

      expect(usuario.id).toBeNull();
      expect(usuario.nombre).toBe('');
      expect(usuario.email).toBe('');
      expect(usuario.biometric_enabled).toBe(false);
      expect(usuario.failed_pin_attempts).toBe(0);
    });
  });

  describe('Static Properties', () => {
    it('should have valid roles', () => {
      expect(Usuario.ROLES_VALIDOS).toEqual(['admin', 'editor', 'lector']);
    });

    it('should have validation constants', () => {
      expect(Usuario.VALIDACIONES.NOMBRE.MIN_LENGTH).toBe(2);
      expect(Usuario.VALIDACIONES.EMAIL.REGEX).toBeDefined();
      expect(Usuario.VALIDACIONES.PASSWORD.MIN_LENGTH).toBe(8);
      expect(Usuario.VALIDACIONES.PIN.LENGTH).toBe(4);
    });
  });

  describe('validarId', () => {
    it('should validate correct IDs', () => {
      expect(Usuario.validarId(1)).toBe(true);
      expect(Usuario.validarId(100)).toBe(true);
      expect(Usuario.validarId('5')).toBe(true);
    });

    it('should reject invalid IDs', () => {
      expect(Usuario.validarId(0)).toBe(false);
      expect(Usuario.validarId(-1)).toBe(false);
      expect(Usuario.validarId('abc')).toBe(false);
      expect(Usuario.validarId(null)).toBe(false);
      expect(Usuario.validarId(undefined)).toBe(false);
      expect(Usuario.validarId(1.5)).toBe(false);
    });
  });

  describe('validarNombre', () => {
    let usuario;

    beforeEach(() => {
      usuario = new Usuario();
    });

    it('should accept valid names', () => {
      expect(usuario.validarNombre('John Doe')).toEqual([]);
      expect(usuario.validarNombre('María García')).toEqual([]);
      expect(usuario.validarNombre('José')).toEqual([]);
    });

    it('should reject empty or null names', () => {
      expect(usuario.validarNombre('')).toContain('El nombre es requerido');
      expect(usuario.validarNombre(null)).toContain('El nombre es requerido');
      expect(usuario.validarNombre('   ')).toContain('El nombre no puede estar vacío');
    });

    it('should reject names too short', () => {
      const errors = usuario.validarNombre('A');
      expect(errors).toContain('El nombre debe tener al menos 2 caracteres');
    });

    it('should reject names too long', () => {
      const longName = 'A'.repeat(51);
      const errors = usuario.validarNombre(longName);
      expect(errors).toContain('El nombre no puede tener más de 50 caracteres');
    });

    it('should reject names with invalid characters', () => {
      expect(usuario.validarNombre('John123')).toContain(
        'El nombre solo puede contener letras, espacios y acentos'
      );
      expect(usuario.validarNombre('John@Doe')).toContain(
        'El nombre solo puede contener letras, espacios y acentos'
      );
    });

    it('should reject names with multiple spaces', () => {
      const errors = usuario.validarNombre('John  Doe');
      expect(errors).toContain(
        'El nombre no puede tener espacios múltiples o espacios al inicio/final'
      );
    });

    it('should reject non-string names', () => {
      expect(usuario.validarNombre(123)).toContain('El nombre debe ser una cadena de texto');
    });
  });

  describe('validarEmail', () => {
    let usuario;

    beforeEach(() => {
      usuario = new Usuario();
    });

    it('should accept valid emails', () => {
      expect(usuario.validarEmail('test@test.com')).toEqual([]);
      expect(usuario.validarEmail('user@example.org')).toEqual([]);
      expect(usuario.validarEmail('john.doe@company.co.uk')).toEqual([]);
    });

    it('should reject empty or null emails', () => {
      expect(usuario.validarEmail('')).toContain('El email es requerido');
      expect(usuario.validarEmail(null)).toContain('El email es requerido');
    });

    it('should reject invalid email formats', () => {
      expect(usuario.validarEmail('invalid')).toContain('El formato del email es inválido');
      expect(usuario.validarEmail('test@')).toContain('El formato del email es inválido');
      expect(usuario.validarEmail('@test.com')).toContain('El formato del email es inválido');
    });

    it('should reject emails too long', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const errors = usuario.validarEmail(longEmail);
      expect(errors).toContain('El email no puede tener más de 255 caracteres');
    });

    it('should reject temporary email domains', () => {
      expect(usuario.validarEmail('test@tempmail.org')).toContain(
        'No se permiten emails temporales'
      );
      expect(usuario.validarEmail('test@10minutemail.com')).toContain(
        'No se permiten emails temporales'
      );
    });

    it('should reject non-string emails', () => {
      expect(usuario.validarEmail(123)).toContain('El email debe ser una cadena de texto');
    });

    it('should trim and lowercase emails', () => {
      const errors = usuario.validarEmail('  TEST@TEST.COM  ');
      expect(errors).toEqual([]);
    });
  });

  describe('validarPassword', () => {
    let usuario;

    beforeEach(() => {
      usuario = new Usuario();
    });

    it('should accept valid passwords', () => {
      expect(usuario.validarPassword('Test123!@#')).toEqual([]);
      expect(usuario.validarPassword('MyP@ssw0rd')).toEqual([]);
    });

    it('should reject empty or null passwords', () => {
      expect(usuario.validarPassword('')).toContain('La contraseña es requerida');
      expect(usuario.validarPassword(null)).toContain('La contraseña es requerida');
    });

    it('should reject passwords too short', () => {
      expect(usuario.validarPassword('Test1!')).toContain(
        'La contraseña debe tener al menos 8 caracteres'
      );
    });

    it('should reject passwords too long', () => {
      const longPassword = 'A'.repeat(129) + '1!';
      expect(usuario.validarPassword(longPassword)).toContain(
        'La contraseña no puede tener más de 128 caracteres'
      );
    });

    it('should reject passwords with spaces', () => {
      expect(usuario.validarPassword('Test 123!')).toContain(
        'La contraseña no puede contener espacios'
      );
    });

    it('should require uppercase letter', () => {
      expect(usuario.validarPassword('test123!')).toContain(
        'La contraseña debe contener al menos una letra mayúscula'
      );
    });

    it('should require lowercase letter', () => {
      expect(usuario.validarPassword('TEST123!')).toContain(
        'La contraseña debe contener al menos una letra minúscula'
      );
    });

    it('should require number', () => {
      expect(usuario.validarPassword('TestTest!')).toContain(
        'La contraseña debe contener al menos un número'
      );
    });

    it('should require special character', () => {
      expect(usuario.validarPassword('Test1234')).toContain(
        'La contraseña debe contener al menos un carácter especial'
      );
    });

    it('should reject common passwords', () => {
      expect(usuario.validarPassword('Password123!')).toContain(
        'La contraseña es demasiado común'
      );
      expect(usuario.validarPassword('12345678')).toContain(
        'La contraseña es demasiado común'
      );
    });

    it('should reject non-string passwords', () => {
      expect(usuario.validarPassword(123456)).toContain(
        'La contraseña debe ser una cadena de texto'
      );
    });
  });

  describe('validarPIN', () => {
    let usuario;

    beforeEach(() => {
      usuario = new Usuario();
    });

    it('should accept valid PINs', () => {
      expect(usuario.validarPIN('5678')).toEqual([]);
      expect(usuario.validarPIN('9012')).toEqual([]);
    });

    it('should reject empty or null PINs', () => {
      expect(usuario.validarPIN('')).toContain('El PIN es requerido');
      expect(usuario.validarPIN(null)).toContain('El PIN es requerido');
    });

    it('should reject PINs with wrong length', () => {
      expect(usuario.validarPIN('123')).toContain('El PIN debe tener exactamente 4 dígitos');
      expect(usuario.validarPIN('12345')).toContain('El PIN debe tener exactamente 4 dígitos');
    });

    it('should reject non-numeric PINs', () => {
      expect(usuario.validarPIN('abcd')).toContain('El PIN debe contener solo números');
      expect(usuario.validarPIN('12a4')).toContain('El PIN debe contener solo números');
    });

    it('should reject common PINs', () => {
      expect(usuario.validarPIN('0000')).toContain('El PIN es demasiado común');
      expect(usuario.validarPIN('1111')).toContain('El PIN es demasiado común');
      expect(usuario.validarPIN('1234')).toContain('El PIN es demasiado común');
    });

    it('should reject non-string PINs', () => {
      expect(usuario.validarPIN(1234)).toContain('El PIN debe ser una cadena de texto');
    });
  });

  describe('validarRol', () => {
    let usuario;

    beforeEach(() => {
      usuario = new Usuario();
    });

    it('should accept valid roles', () => {
      expect(usuario.validarRol('admin')).toEqual([]);
      expect(usuario.validarRol('editor')).toEqual([]);
      expect(usuario.validarRol('lector')).toEqual([]);
    });

    it('should accept roles with different casing', () => {
      expect(usuario.validarRol('ADMIN')).toEqual([]);
      expect(usuario.validarRol('Editor')).toEqual([]);
    });

    it('should reject empty or null roles', () => {
      expect(usuario.validarRol('')).toContain('El rol es requerido');
      expect(usuario.validarRol(null)).toContain('El rol es requerido');
      expect(usuario.validarRol('   ')).toContain('El rol no puede estar vacío');
    });

    it('should reject invalid roles', () => {
      expect(usuario.validarRol('superadmin')).toContain(
        'El rol debe ser uno de: admin, editor, lector'
      );
      expect(usuario.validarRol('user')).toContain(
        'El rol debe ser uno de: admin, editor, lector'
      );
    });

    it('should reject non-string roles', () => {
      expect(usuario.validarRol(123)).toContain('El rol debe ser una cadena de texto');
    });
  });

  describe('obtenerTodos', () => {
    it('should get all users successfully', async () => {
      const mockUsers = [
        { id: 1, nombre: 'User 1', email: 'user1@test.com', rol: 'admin' },
        { id: 2, nombre: 'User 2', email: 'user2@test.com', rol: 'lector' }
      ];

      query.mockResolvedValue({ rows: mockUsers });

      const result = await Usuario.obtenerTodos();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Usuario);
      expect(result[0].nombre).toBe('User 1');
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('DB error'));

      await expect(Usuario.obtenerTodos()).rejects.toThrow(
        'Error al consultar usuarios en la base de datos'
      );
    });
  });

  describe('obtenerPorId', () => {
    it('should get user by ID successfully', async () => {
      const mockUser = { id: 1, nombre: 'Test User', email: 'test@test.com', rol: 'admin' };
      query.mockResolvedValue({ rows: [mockUser] });

      const result = await Usuario.obtenerPorId(1);

      expect(result).toBeInstanceOf(Usuario);
      expect(result.nombre).toBe('Test User');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });

    it('should return null if user not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await Usuario.obtenerPorId(999);

      expect(result).toBeNull();
    });

    it('should throw error for invalid ID', async () => {
      await expect(Usuario.obtenerPorId('invalid')).rejects.toThrow('ID de usuario inválido');
    });

    it('should handle database errors', async () => {
      query.mockRejectedValue(new Error('DB error'));

      await expect(Usuario.obtenerPorId(1)).rejects.toThrow();
    });
  });

  describe('obtenerPorEmail', () => {
    it('should get user by email successfully', async () => {
      const mockUser = { id: 1, nombre: 'Test User', email: 'test@test.com' };
      query.mockResolvedValue({ rows: [mockUser] });

      const result = await Usuario.obtenerPorEmail('test@test.com');

      expect(result).toBeInstanceOf(Usuario);
      expect(result.email).toBe('test@test.com');
    });

    it('should return null if user not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await Usuario.obtenerPorEmail('notfound@test.com');

      expect(result).toBeNull();
    });

    it('should handle case-insensitive email', async () => {
      query.mockResolvedValue({ rows: [{ email: 'test@test.com' }] });

      await Usuario.obtenerPorEmail('TEST@TEST.COM');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(email) = LOWER($1)'),
        ['TEST@TEST.COM']
      );
    });

    it('should trim email', async () => {
      query.mockResolvedValue({ rows: [] });

      await Usuario.obtenerPorEmail('  test@test.com  ');

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['test@test.com']
      );
    });

    it('should throw error for invalid email', async () => {
      await expect(Usuario.obtenerPorEmail(null)).rejects.toThrow('Email inválido');
      await expect(Usuario.obtenerPorEmail(123)).rejects.toThrow('Email inválido');
    });
  });

  describe('encriptarPassword', () => {
    it('should encrypt password successfully', async () => {
      const usuario = new Usuario(null, 'Test', 'test@test.com', 'Test123!', 'admin');
      bcrypt.hash.mockResolvedValue('hashed_password');

      await usuario.encriptarPassword();

      expect(bcrypt.hash).toHaveBeenCalledWith('Test123!', 12);
      expect(usuario.password).toBe('hashed_password');
    });

    it('should not encrypt if password is empty', async () => {
      const usuario = new Usuario();
      await usuario.encriptarPassword();

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should use SALT_ROUNDS from env', async () => {
      process.env.SALT_ROUNDS = '10';
      const usuario = new Usuario(null, 'Test', 'test@test.com', 'Test123!', 'admin');
      bcrypt.hash.mockResolvedValue('hashed');

      await usuario.encriptarPassword();

      expect(bcrypt.hash).toHaveBeenCalledWith('Test123!', 10);
    });
  });

  describe('verificarPassword', () => {
    it('should verify correct password', async () => {
      const usuario = new Usuario();
      usuario.password = 'hashed_password';
      bcrypt.compare.mockResolvedValue(true);

      const result = await usuario.verificarPassword('plain_password');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('plain_password', 'hashed_password');
    });

    it('should reject incorrect password', async () => {
      const usuario = new Usuario();
      usuario.password = 'hashed_password';
      bcrypt.compare.mockResolvedValue(false);

      const result = await usuario.verificarPassword('wrong_password');

      expect(result).toBe(false);
    });

    it('should return false if password is null', async () => {
      const usuario = new Usuario();
      const result = await usuario.verificarPassword('any_password');

      expect(result).toBe(false);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('encriptarPIN', () => {
    it('should encrypt PIN successfully', async () => {
      const usuario = new Usuario();
      bcrypt.hash.mockResolvedValue('hashed_pin');

      await usuario.encriptarPIN('5678');

      expect(bcrypt.hash).toHaveBeenCalledWith('5678', 10);
      expect(usuario.pin_hash).toBe('hashed_pin');
      expect(usuario.biometric_enabled).toBe(true);
      expect(usuario.failed_pin_attempts).toBe(0);
    });
  });

  describe('verificarPIN', () => {
    it('should verify correct PIN', async () => {
      const usuario = new Usuario();
      usuario.pin_hash = 'hashed_pin';
      bcrypt.compare.mockResolvedValue(true);

      const result = await usuario.verificarPIN('5678');

      expect(result).toBe(true);
    });

    it('should reject incorrect PIN', async () => {
      const usuario = new Usuario();
      usuario.pin_hash = 'hashed_pin';
      bcrypt.compare.mockResolvedValue(false);

      const result = await usuario.verificarPIN('0000');

      expect(result).toBe(false);
    });
  });

  describe('estaPINBloqueado', () => {
    it('should return true if locked until future date', () => {
      const usuario = new Usuario();
      usuario.pin_locked_until = new Date(Date.now() + 10000);

      expect(usuario.estaPINBloqueado()).toBe(true);
    });

    it('should return true if failed attempts >= 5', () => {
      const usuario = new Usuario();
      usuario.failed_pin_attempts = 5;

      expect(usuario.estaPINBloqueado()).toBe(true);
    });

    it('should return false if not locked', () => {
      const usuario = new Usuario();
      usuario.failed_pin_attempts = 2;

      expect(usuario.estaPINBloqueado()).toBe(false);
    });
  });

  describe('guardar', () => {
    it('should save new user successfully', async () => {
      const usuario = new Usuario(null, 'Test User', 'test@test.com', 'Test123!', 'admin');
      
      query
        .mockResolvedValueOnce({ rows: [] }) // Email no existe
        .mockResolvedValueOnce({
          rows: [{ id: 1, nombre: 'Test User', email: 'test@test.com', rol: 'admin' }]
        });

      bcrypt.hash.mockResolvedValue('hashed_password');

      await usuario.guardar();

      expect(usuario.id).toBe(1);
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Usuario creado')
      );
    });

    it('should reject duplicate email', async () => {
      const usuario = new Usuario(null, 'Test', 'test@test.com', 'Test123!', 'admin');
      
      query.mockResolvedValue({
        rows: [{ id: 2, email: 'test@test.com' }]
      });

      await expect(usuario.guardar()).rejects.toThrow(
        'Ya existe un usuario registrado con ese email'
      );
    });

    it('should reject invalid data', async () => {
      const usuario = new Usuario(null, 'A', 'invalid', 'short', 'invalid_role');

      await expect(usuario.guardar()).rejects.toThrow('Errores de validación');
    });

    it('should save Google user without password', async () => {
      const usuario = new Usuario(null, 'Test', 'test@test.com', null, 'admin');
      usuario.proveedor = 'google';

      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, proveedor: 'google' }]
        });

      await usuario.guardar();

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(usuario.id).toBe(1);
    });
  });

  describe('actualizar', () => {
    it('should update user successfully', async () => {
      const usuario = new Usuario(1, 'Updated Name', 'test@test.com', null, 'editor');

      query
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@test.com' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, nombre: 'Updated Name', rol: 'editor' }]
        });

      await usuario.actualizar();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Usuario actualizado')
      );
    });

    it('should throw error if no ID', async () => {
      const usuario = new Usuario(null, 'Test', 'test@test.com', null, 'admin');

      await expect(usuario.actualizar()).rejects.toThrow(
        'No se puede actualizar un usuario sin ID'
      );
    });

    it('should reject duplicate email from other user', async () => {
      const usuario = new Usuario(1, 'Test', 'taken@test.com', null, 'admin');

      query.mockResolvedValue({
        rows: [{ id: 2, email: 'taken@test.com' }]
      });

      await expect(usuario.actualizar()).rejects.toThrow(
        'Ya existe otro usuario con ese email'
      );
    });

    it('should update password if provided', async () => {
      const usuario = new Usuario(1, 'Test', 'test@test.com', 'NewPass123!', 'admin');

      query
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@test.com' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      bcrypt.hash.mockResolvedValue('new_hashed');

      await usuario.actualizar();

      expect(bcrypt.hash).toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('should delete user successfully', async () => {
      const usuario = new Usuario(1);

      query.mockResolvedValue({
        rowCount: 1,
        rows: [{ nombre: 'Test', email: 'test@test.com' }]
      });

      const result = await usuario.eliminar();

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Usuario eliminado')
      );
    });

    it('should throw error if no ID', async () => {
      const usuario = new Usuario();

      await expect(usuario.eliminar()).rejects.toThrow(
        'No se puede eliminar un usuario sin ID'
      );
    });

    it('should throw error if user not found', async () => {
      const usuario = new Usuario(999);

      query.mockResolvedValue({ rowCount: 0, rows: [] });

      await expect(usuario.eliminar()).rejects.toThrow(
        'Usuario no encontrado para eliminar'
      );
    });
  });

  describe('configurarPIN', () => {
    it('should configure PIN successfully', async () => {
      const usuario = new Usuario(1);
      bcrypt.hash.mockResolvedValue('hashed_pin');

      query.mockResolvedValue({
        rows: [{ id: 1, biometric_enabled: true }]
      });

      await usuario.configurarPIN('5678');

      expect(usuario.biometric_enabled).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ PIN configurado')
      );
    });

    it('should reject invalid PIN', async () => {
      const usuario = new Usuario(1);

      await expect(usuario.configurarPIN('1234')).rejects.toThrow(
        'Errores de validación del PIN'
      );
    });
  });

  describe('deshabilitarBiometrico', () => {
    it('should disable biometric successfully', async () => {
      const usuario = new Usuario(1);

      query.mockResolvedValue({
        rows: [{ id: 1, biometric_enabled: false }]
      });

      await usuario.deshabilitarBiometrico();

      expect(usuario.biometric_enabled).toBe(false);
      expect(usuario.pin_hash).toBeNull();
    });
  });

  describe('toJSON', () => {
    it('should remove sensitive data', () => {
      const usuario = new Usuario(1, 'Test', 'test@test.com', 'password', 'admin');
      usuario.pin_hash = 'hashed_pin';

      const json = usuario.toJSON();

      expect(json.password).toBeUndefined();
      expect(json.pin_hash).toBeUndefined();
      expect(json.nombre).toBe('Test');
    });
  });

  describe('obtenerEstadisticasPorRol', () => {
    it('should get statistics by role', async () => {
      const mockStats = [
        { rol: 'admin', cantidad: 5, nuevos_ultimo_mes: 1, con_biometrico: 3 },
        { rol: 'lector', cantidad: 10, nuevos_ultimo_mes: 2, con_biometrico: 5 }
      ];

      query.mockResolvedValue({ rows: mockStats });

      const result = await Usuario.obtenerEstadisticasPorRol();

      expect(result).toEqual(mockStats);
    });
  });

  describe('Token Management', () => {
    it('should generate and save token', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ id: 1, token: 'abc123' }] });

      const result = await Usuario.generarYGuardarToken(1);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiry');
    });

    it('should get valid token', async () => {
      query.mockResolvedValue({
        rows: [{ token: 'abc123', user_id: 1, email: 'test@test.com' }]
      });

      const result = await Usuario.obtenerTokenValido('abc123');

      expect(result).toHaveProperty('token');
      expect(result.user_id).toBe(1);
    });

    it('should return null for invalid token', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await Usuario.obtenerTokenValido('invalid');

      expect(result).toBeNull();
    });
  });
});