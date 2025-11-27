const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// ✅ FUNCIÓN DE UTILIDAD PARA GENERAR TOKENS
const generarTokenSeguro = (longitud = 32) => {
  const crypto = require('crypto');
  return crypto.randomBytes(longitud).toString('hex');
};

class Usuario {
  constructor(id = null, nombre = '', email = '', password = '', rol = '', 
              otp = null, otp_expires = null, proveedor = null,
              pin_hash = null, pin_created_at = null, biometric_enabled = false,
              failed_pin_attempts = 0, pin_locked_until = null) {
    this.id = id;
    this.nombre = nombre;
    this.email = email;
    this.password = password;
    this.rol = rol;
    this.fecha_creacion = null;
    this.otp = otp;
    this.otp_expires = otp_expires;
    this.proveedor = proveedor; 
    this.current_latitude = null;
    this.current_longitude = null;
    this.last_location_update = null;
    this.accuracy = null;
    
    // Nuevas propiedades biométricas
    this.pin_hash = pin_hash;
    this.pin_created_at = pin_created_at;
    this.biometric_enabled = biometric_enabled;
    this.failed_pin_attempts = failed_pin_attempts;
    this.pin_locked_until = pin_locked_until;
  }

  // Validar roles permitidos
  static get ROLES_VALIDOS() {
    return ['admin', 'editor', 'lector'];
  }

  // Constantes de validación
  static get VALIDACIONES() {
    return {
      NOMBRE: {
        MIN_LENGTH: 2,
        MAX_LENGTH: 50,
        REGEX: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
        REGEX_NO_ESPACIOS_MULTIPLES: /^\S+(\s\S+)*$/
      },
      EMAIL: {
        MAX_LENGTH: 255,
        REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      },
      PASSWORD: {
        MIN_LENGTH: 8,
        MAX_LENGTH: 128,
        REGEX_UPPERCASE: /[A-Z]/,
        REGEX_LOWERCASE: /[a-z]/,
        REGEX_NUMBER: /[0-9]/,
        REGEX_SPECIAL: /[!@#$%^&*(),.?":{}|<>]/,
        REGEX_NO_SPACES: /^\S+$/
      },
      PIN: {
        LENGTH: 4,
        REGEX: /^\d{4}$/
      }
    };
  }

 static async eliminarCompleto(id) {
  try {
    const query = require('../config/database').query;
    
    // Verificar que el usuario existe
    const usuarioExistente = await query(
      'SELECT id, nombre, email FROM usuarios WHERE id = $1',
      [id]
    );
    
    if (usuarioExistente.rowCount === 0) {
      console.log('❌ Usuario no encontrado');
      return false;
    }

    const usuario = usuarioExistente.rows[0];
    console.log(`🧹 Iniciando eliminación de: ${usuario.nombre} (ID: ${id})`);
    
    await query('BEGIN');
    
    try {
      // Tablas que sabemos que existen y pueden tener FK a usuarios
      const tablasConReferencias = [
        { tabla: 'notificaciones', columna: 'usuario_id' },
        { tabla: 'ordenes', columna: 'usuario_id' },
        { tabla: 'transacciones', columna: 'usuario_id' },
        { tabla: 'movimientos_inventario', columna: 'usuario_id' },
        { tabla: 'alertas_stock', columna: 'usuario_id' },
        { tabla: 'password_reset_tokens', columna: 'user_id' }
      ];
      
      let totalEliminado = 0;
      
      for (const { tabla, columna } of tablasConReferencias) {
        try {
          const result = await query(
            `DELETE FROM ${tabla} WHERE ${columna} = $1`,
            [id]
          );
          
          if (result.rowCount > 0) {
            console.log(`🗑️ ${tabla}: ${result.rowCount} registros eliminados`);
            totalEliminado += result.rowCount;
          }
        } catch (e) {
          // Si la tabla no existe o no tiene la columna, continuar
          console.log(`ℹ️ No se pudo eliminar de ${tabla}: ${e.message}`);
        }
      }
      
      console.log(`📊 Total de registros dependientes eliminados: ${totalEliminado}`);
      
      // Eliminar el usuario
      const usuarioResult = await query(
        'DELETE FROM usuarios WHERE id = $1 RETURNING id, nombre, email',
        [id]
      );
      
      await query('COMMIT');
      
      console.log(`✅ Eliminación completada para: ${usuario.nombre}`);
      return usuarioResult.rowCount > 0;
      
    } catch (error) {
      await query('ROLLBACK');
      console.error('❌ Error en transacción:', error);
      throw error;
    }
    
  } catch (err) {
    console.error('❌ Error en eliminación completa:', err);
    throw err;
  }
}

  // ✅ MÉTODO PARA GENERAR Y GUARDAR TOKEN
  static async generarYGuardarToken(userId) {
    const token = generarTokenSeguro(32);
    const expiry = new Date(Date.now() + 3600000); // 1 hora
    
    const tokenData = await Usuario.guardarTokenRestablecimiento(userId, token, expiry);
    return { token, expiry, tokenData };
  }

  // Actualizar ubicación del usuario
  static async actualizarUbicacion(userId, ubicacion) {
    const { latitude, longitude, accuracy, timestamp } = ubicacion;

    try {
      // Actualizar columnas en la tabla usuarios
      const result = await query(
        `UPDATE usuarios
         SET current_latitude = $1,
             current_longitude = $2,
             last_location_update = $3,
             accuracy = $4
         WHERE id = $5
         RETURNING id, current_latitude, current_longitude, last_location_update, accuracy`,
        [latitude, longitude, timestamp, accuracy, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Usuario no encontrado para actualizar ubicación');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error al actualizar ubicación en DB:', error.message);
      throw new Error('Error al actualizar ubicación del usuario');
    }
  }

  // Obtener todos los usuarios (incluyendo datos biométricos básicos)
  static async obtenerTodos() {
    try {
      const result = await query(
        `SELECT id, nombre, email, rol, fecha_creacion, 
                biometric_enabled, pin_created_at, failed_pin_attempts
         FROM usuarios ORDER BY fecha_creacion DESC`
      );
      
      return result.rows.map(row => {
        const usuario = new Usuario();
        Object.assign(usuario, row);
        return usuario;
      });
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw new Error('Error al consultar usuarios en la base de datos');
    }
  }

  // Obtener usuario por ID (con datos biométricos)
  static async obtenerPorId(id) {
    try {
      // Validar ID
      if (!Usuario.validarId(id)) {
        throw new Error('ID de usuario inválido');
      }

      const result = await query(
        `SELECT id, nombre, email, rol, fecha_creacion, 
                biometric_enabled, pin_created_at, failed_pin_attempts, pin_locked_until
         FROM usuarios WHERE id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const usuario = new Usuario();
      Object.assign(usuario, result.rows[0]);
      return usuario;
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      throw error;
    }
  }

  // Obtener usuario por email (con datos biométricos completos)
  static async obtenerPorEmail(email) {
    try {
      // Validar email básico
      if (!email || typeof email !== 'string') {
        throw new Error('Email inválido');
      }

      const result = await query(
        'SELECT * FROM usuarios WHERE LOWER(email) = LOWER($1)',
        [email.trim()]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const usuario = new Usuario();
      Object.assign(usuario, result.rows[0]);
      return usuario;
    } catch (error) {
      console.error('Error al obtener usuario por email:', error);
      throw error;
    }
  }

  // Obtener usuario con datos biométricos completos (para verificación de PIN)
  static async obtenerConDatosBiometricos(id) {
    try {
      const result = await query(
        `SELECT id, nombre, email, rol, fecha_creacion,
                pin_hash, biometric_enabled, failed_pin_attempts, pin_locked_until
         FROM usuarios WHERE id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const usuario = new Usuario();
      Object.assign(usuario, result.rows[0]);
      return usuario;
    } catch (error) {
      console.error('Error al obtener usuario con datos biométricos:', error);
      throw error;
    }
  }

  // Validar ID
  static validarId(id) {
    if (!id) return false;
    const numId = parseInt(id);
    return !isNaN(numId) && numId > 0 && Number.isInteger(numId);
  }

  // ✅ MÉTODOS PARA TOKENS DE RESTABLECIMIENTO

  // Método para guardar token de restablecimiento
  static async guardarTokenRestablecimiento(userId, token, expiry) {
    try {
      // Primero eliminar cualquier token existente para este usuario
      await query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [userId]
      );

      // Insertar nuevo token
      const result = await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
         VALUES ($1, $2, $3) 
         RETURNING id, user_id, token, expires_at, created_at`,
        [userId, token, expiry]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error al guardar token de restablecimiento:', error);
      throw new Error('Error al generar token de restablecimiento');
    }
  }

  // Método para obtener token de restablecimiento válido
  static async obtenerTokenValido(token) {
    try {
      const result = await query(
        `SELECT prt.*, u.id as user_id, u.email, u.nombre 
         FROM password_reset_tokens prt
         JOIN usuarios u ON prt.user_id = u.id
         WHERE prt.token = $1 AND prt.expires_at > NOW()`,
        [token]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error al obtener token válido:', error);
      throw new Error('Error al verificar token');
    }
  }

  // Método para eliminar token usado
  static async eliminarToken(token) {
    try {
      await query(
        'DELETE FROM password_reset_tokens WHERE token = $1',
        [token]
      );
    } catch (error) {
      console.error('Error al eliminar token:', error);
      throw new Error('Error al procesar token');
    }
  }

  // Método para eliminar tokens expirados
  static async limpiarTokensExpirados() {
    try {
      const result = await query(
        'DELETE FROM password_reset_tokens WHERE expires_at <= NOW() RETURNING id'
      );
      
      if (result.rowCount > 0) {
        console.log(`🧹 Tokens expirados eliminados: ${result.rowCount}`);
      }
      
      return result.rowCount;
    } catch (error) {
      console.error('Error al limpiar tokens expirados:', error);
      return 0;
    }
  }

  // Método para cambiar contraseña usando token
  static async cambiarPasswordConToken(token, nuevaPassword) {
    try {
      // Obtener token válido
      const tokenData = await Usuario.obtenerTokenValido(token);
      if (!tokenData) {
        throw new Error('Token inválido o expirado');
      }

      // Obtener usuario
      const usuario = await Usuario.obtenerPorId(tokenData.user_id);
      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }

      // Validar nueva contraseña
      const erroresPassword = usuario.validarPassword(nuevaPassword);
      if (erroresPassword.length > 0) {
        throw new Error(`Contraseña inválida: ${erroresPassword.join(', ')}`);
      }

      // Cambiar contraseña
      usuario.password = nuevaPassword;
      await usuario.encriptarPassword();
      
      // Actualizar en base de datos
      const result = await query(
        'UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING id',
        [usuario.password, usuario.id]
      );

      if (result.rowCount === 0) {
        throw new Error('Error al actualizar contraseña');
      }

      // Eliminar token usado
      await Usuario.eliminarToken(token);

      console.log(`✅ Contraseña restablecida para: ${usuario.email}`);
      return usuario;

    } catch (error) {
      console.error('Error al cambiar contraseña con token:', error);
      throw error;
    }
  }

  // Método para obtener tokens activos de un usuario
  static async obtenerTokensActivos(userId) {
    try {
      const result = await query(
        `SELECT id, token, expires_at, created_at 
         FROM password_reset_tokens 
         WHERE user_id = $1 AND expires_at > NOW() 
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error al obtener tokens activos:', error);
      throw new Error('Error al consultar tokens');
    }
  }

  // ✅ MÉTODO PARA VERIFICAR TOKENS ACTIVOS
  static async tieneTokensActivos(userId) {
    try {
      const tokens = await Usuario.obtenerTokensActivos(userId);
      return tokens.length > 0;
    } catch (error) {
      console.error('Error verificando tokens activos:', error);
      return false;
    }
  }

  // Validar PIN
  validarPIN(pin) {
    const errores = [];
    
    if (!pin) {
      errores.push('El PIN es requerido');
      return errores;
    }

    if (typeof pin !== 'string') {
      errores.push('El PIN debe ser una cadena de texto');
      return errores;
    }

    if (pin.length !== Usuario.VALIDACIONES.PIN.LENGTH) {
      errores.push(`El PIN debe tener exactamente ${Usuario.VALIDACIONES.PIN.LENGTH} dígitos`);
    }

    if (!Usuario.VALIDACIONES.PIN.REGEX.test(pin)) {
      errores.push('El PIN debe contener solo números');
    }

    // Verificar PINs comunes inseguros
    const pinsComunes = ['0000', '1111', '1234', '9999', '2580'];
    if (pinsComunes.includes(pin)) {
      errores.push('El PIN es demasiado común, elige uno más seguro');
    }

    return errores;
  }

  // Validar y limpiar nombre
  validarNombre(nombre) {
    const errores = [];
    
    if (!nombre) {
      errores.push('El nombre es requerido');
      return errores;
    }

    if (typeof nombre !== 'string') {
      errores.push('El nombre debe ser una cadena de texto');
      return errores;
    }

    const nombreLimpio = nombre.trim();
    
    if (nombreLimpio.length === 0) {
      errores.push('El nombre no puede estar vacío');
      return errores;
    }

    if (nombreLimpio.length < Usuario.VALIDACIONES.NOMBRE.MIN_LENGTH) {
      errores.push(`El nombre debe tener al menos ${Usuario.VALIDACIONES.NOMBRE.MIN_LENGTH} caracteres`);
    }

    if (nombreLimpio.length > Usuario.VALIDACIONES.NOMBRE.MAX_LENGTH) {
      errores.push(`El nombre no puede tener más de ${Usuario.VALIDACIONES.NOMBRE.MAX_LENGTH} caracteres`);
    }

    // Solo letras, espacios y acentos
    if (!Usuario.VALIDACIONES.NOMBRE.REGEX.test(nombreLimpio)) {
      errores.push('El nombre solo puede contener letras, espacios y acentos');
    }

    // No espacios múltiples o al inicio/final
    if (!Usuario.VALIDACIONES.NOMBRE.REGEX_NO_ESPACIOS_MULTIPLES.test(nombreLimpio)) {
      errores.push('El nombre no puede tener espacios múltiples o espacios al inicio/final');
    }

    // No solo espacios
    if (nombreLimpio.replace(/\s/g, '').length === 0) {
      errores.push('El nombre no puede contener solo espacios');
    }

    return errores;
  }

  // Validar email
  validarEmail(email) {
    const errores = [];
    
    if (!email) {
      errores.push('El email es requerido');
      return errores;
    }

    if (typeof email !== 'string') {
      errores.push('El email debe ser una cadena de texto');
      return errores;
    }

    const emailLimpio = email.trim().toLowerCase();
    
    if (emailLimpio.length === 0) {
      errores.push('El email no puede estar vacío');
      return errores;
    }

    if (emailLimpio.length > Usuario.VALIDACIONES.EMAIL.MAX_LENGTH) {
      errores.push(`El email no puede tener más de ${Usuario.VALIDACIONES.EMAIL.MAX_LENGTH} caracteres`);
    }

    if (!Usuario.VALIDACIONES.EMAIL.REGEX.test(emailLimpio)) {
      errores.push('El formato del email es inválido');
    }

    // Verificar dominios comunes
    const dominiosProhibidos = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
    const dominio = emailLimpio.split('@')[1];
    if (dominio && dominiosProhibidos.includes(dominio)) {
      errores.push('No se permiten emails temporales');
    }

    return errores;
  }

  // Validar contraseña
  validarPassword(password) {
    const errores = [];
    
    if (!password) {
      errores.push('La contraseña es requerida');
      return errores;
    }

    if (typeof password !== 'string') {
      errores.push('La contraseña debe ser una cadena de texto');
      return errores;
    }

    if (password.length < Usuario.VALIDACIONES.PASSWORD.MIN_LENGTH) {
      errores.push(`La contraseña debe tener al menos ${Usuario.VALIDACIONES.PASSWORD.MIN_LENGTH} caracteres`);
    }

    if (password.length > Usuario.VALIDACIONES.PASSWORD.MAX_LENGTH) {
      errores.push(`La contraseña no puede tener más de ${Usuario.VALIDACIONES.PASSWORD.MAX_LENGTH} caracteres`);
    }

    if (!Usuario.VALIDACIONES.PASSWORD.REGEX_NO_SPACES.test(password)) {
      errores.push('La contraseña no puede contener espacios');
    }

    if (!Usuario.VALIDACIONES.PASSWORD.REGEX_UPPERCASE.test(password)) {
      errores.push('La contraseña debe contener al menos una letra mayúscula');
    }

    if (!Usuario.VALIDACIONES.PASSWORD.REGEX_LOWERCASE.test(password)) {
      errores.push('La contraseña debe contener al menos una letra minúscula');
    }

    if (!Usuario.VALIDACIONES.PASSWORD.REGEX_NUMBER.test(password)) {
      errores.push('La contraseña debe contener al menos un número');
    }

    if (!Usuario.VALIDACIONES.PASSWORD.REGEX_SPECIAL.test(password)) {
      errores.push('La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)');
    }

    // Verificar contraseñas comunes
    const passwordsComunes = [
      'password', '12345678', 'qwerty123', 'abc12345', 
      'password123', '123456789', 'admin123', 'user1234'
    ];
    
    if (passwordsComunes.includes(password.toLowerCase())) {
      errores.push('La contraseña es demasiado común, elige una más segura');
    }

    return errores;
  }

  // Validar rol
  validarRol(rol) {
    const errores = [];
    
    if (!rol) {
      errores.push('El rol es requerido');
      return errores;
    }

    if (typeof rol !== 'string') {
      errores.push('El rol debe ser una cadena de texto');
      return errores;
    }

    const rolLimpio = rol.trim().toLowerCase();
    
    // Verificar que el rol no esté vacío después del trim
    if (rolLimpio.length === 0) {
      errores.push('El rol no puede estar vacío');
      return errores;
    }

    // Verificar que el rol no contenga solo espacios
    if (rol.trim().replace(/\s/g, '').length === 0) {
      errores.push('El rol no puede contener solo espacios');
      return errores;
    }
    
    if (!Usuario.ROLES_VALIDOS.includes(rolLimpio)) {
      errores.push(`El rol debe ser uno de: ${Usuario.ROLES_VALIDOS.join(', ')}`);
    }

    return errores;
  }

  validar(esActualizacion = false) {
    const errores = [];

    // Validar nombre
    errores.push(...this.validarNombre(this.nombre));

    // Validar email
    errores.push(...this.validarEmail(this.email));

    // Validar contraseña solo si no es actualización o si se proporciona
    // PERO si el proveedor es google, NO la pidas
    if (!esActualizacion) {
      if (!this.proveedor || this.proveedor !== 'google') {
        errores.push(...this.validarPassword(this.password));
      }
    } else if (this.password && (!this.proveedor || this.proveedor !== 'google')) {
      errores.push(...this.validarPassword(this.password));
    }

    // Validar rol
    errores.push(...this.validarRol(this.rol));

    // Limpiar datos si no hay errores críticos
    if (errores.length === 0) {
      this.nombre = this.nombre.trim();
      this.email = this.email.trim().toLowerCase();
      this.rol = this.rol.trim().toLowerCase();
    }

    return errores;
  }

  // Encriptar contraseña
  async encriptarPassword() {
    if (this.password) {
      const saltRounds = parseInt(process.env.SALT_ROUNDS) || 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
    }
  }

  // Encriptar PIN
  async encriptarPIN(pin) {
    if (pin) {
      const saltRounds = 10; // Menos rounds para PINs más cortos
      this.pin_hash = await bcrypt.hash(pin, saltRounds);
      this.pin_created_at = new Date();
      this.biometric_enabled = true;
      this.failed_pin_attempts = 0;
      this.pin_locked_until = null;
    }
  }

  // Verificar contraseña
  async verificarPassword(passwordPlano) {
    if (!this.password || !passwordPlano) {
      return false;
    }
    return await bcrypt.compare(passwordPlano, this.password);
  }

  // Verificar PIN
  async verificarPIN(pinPlano) {
    if (!this.pin_hash || !pinPlano) {
      return false;
    }
    return await bcrypt.compare(pinPlano, this.pin_hash);
  }

  // Verificar si el PIN está bloqueado
  estaPINBloqueado() {
    if (this.pin_locked_until && this.pin_locked_until > new Date()) {
      return true;
    }
    return this.failed_pin_attempts >= 5;
  }

  // Incrementar intentos fallidos de PIN
  async incrementarIntentosFallidos() {
    this.failed_pin_attempts += 1;
    
    if (this.failed_pin_attempts >= 5) {
      this.pin_locked_until = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    }

    await this.actualizarIntentosPIN();
  }

  // Resetear intentos fallidos de PIN
  async resetearIntentosFallidos() {
    this.failed_pin_attempts = 0;
    this.pin_locked_until = null;
    await this.actualizarIntentosPIN();
  }

  // Actualizar intentos de PIN en la base de datos
  async actualizarIntentosPIN() {
    try {
      await query(
        `UPDATE usuarios 
         SET failed_pin_attempts = $1, pin_locked_until = $2 
         WHERE id = $3`,
        [this.failed_pin_attempts, this.pin_locked_until, this.id]
      );
    } catch (error) {
      console.error('Error actualizando intentos de PIN:', error);
      throw error;
    }
  }

  // Configurar PIN biométrico
  async configurarPIN(pin) {
    const erroresPIN = this.validarPIN(pin);
    if (erroresPIN.length > 0) {
      throw new Error(`Errores de validación del PIN: ${erroresPIN.join(', ')}`);
    }

    await this.encriptarPIN(pin);
    
    try {
      const result = await query(
        `UPDATE usuarios 
         SET pin_hash = $1, pin_created_at = $2, biometric_enabled = $3,
             failed_pin_attempts = $4, pin_locked_until = $5
         WHERE id = $6 
         RETURNING id, nombre, email, biometric_enabled, pin_created_at`,
        [this.pin_hash, this.pin_created_at, this.biometric_enabled, 
         this.failed_pin_attempts, this.pin_locked_until, this.id]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuario no encontrado para configurar PIN');
      }

      console.log(`✅ PIN configurado para usuario: ${this.nombre} (${this.email})`);
      return this;

    } catch (error) {
      console.error('Error configurando PIN:', error.message);
      throw error;
    }
  }

  // Deshabilitar autenticación biométrica
  async deshabilitarBiometrico() {
    try {
      const result = await query(
        `UPDATE usuarios 
         SET pin_hash = NULL, pin_created_at = NULL, biometric_enabled = false,
             failed_pin_attempts = 0, pin_locked_until = NULL
         WHERE id = $1 
         RETURNING id, nombre, email, biometric_enabled`,
        [this.id]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuario no encontrado para deshabilitar biométrico');
      }

      this.pin_hash = null;
      this.pin_created_at = null;
      this.biometric_enabled = false;
      this.failed_pin_attempts = 0;
      this.pin_locked_until = null;

      console.log(`✅ Autenticación biométrica deshabilitada para: ${this.nombre} (${this.email})`);
      return this;

    } catch (error) {
      console.error('Error deshabilitando biométrico:', error.message);
      throw error;
    }
  }

  // Guardar usuario (crear nuevo)
  async guardar() {
    try {
      // Validar datos
      const errores = this.validar();
      if (errores.length > 0) {
        throw new Error(`Errores de validación: ${errores.join(', ')}`);
      }

      // Verificar si ya existe el email
      const usuarioExistente = await Usuario.obtenerPorEmail(this.email);
      if (usuarioExistente) {
        throw new Error('Ya existe un usuario registrado con ese email');
      }

      // Encriptar contraseña solo si existe
      if (this.password) {
        await this.encriptarPassword();
      }

      // Insertar en base de datos (incluye columnas biométricas)
      const result = await query(
        `INSERT INTO usuarios (nombre, email, password, rol, proveedor, 
         biometric_enabled, failed_pin_attempts) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, nombre, email, rol, fecha_creacion, proveedor, biometric_enabled`,
        [this.nombre, this.email, this.password || null, this.rol, this.proveedor || null,
         this.biometric_enabled, this.failed_pin_attempts]
      );

      // Actualizar objeto con datos devueltos
      const usuarioGuardado = result.rows[0];
      this.id = usuarioGuardado.id;
      this.fecha_creacion = usuarioGuardado.fecha_creacion;
      this.proveedor = usuarioGuardado.proveedor;
      this.biometric_enabled = usuarioGuardado.biometric_enabled;

      console.log(`✅ Usuario creado: ${this.nombre} (${this.email}) - Rol: ${this.rol}`);
      return this;

    } catch (error) {
      console.error('Error al guardar usuario:', error.message);
      throw error;
    }
  }

  // Actualizar usuario existente
  async actualizar() {
    try {
      if (!this.id) {
        throw new Error('No se puede actualizar un usuario sin ID');
      }

      // Validar datos (es actualización)
      const errores = this.validar(true);
      if (errores.length > 0) {
        throw new Error(`Errores de validación: ${errores.join(', ')}`);
      }

      // Verificar si el email ya existe en otro usuario
      const usuarioConEmail = await Usuario.obtenerPorEmail(this.email);
      if (usuarioConEmail && usuarioConEmail.id !== this.id) {
        throw new Error('Ya existe otro usuario con ese email');
      }

      let queryText = '';
      let params = [];

      // Si hay nueva contraseña, encriptarla e incluirla
      if (this.password) {
        await this.encriptarPassword();
        queryText = `UPDATE usuarios 
                     SET nombre = $1, email = $2, rol = $3, password = $4
                     WHERE id = $5 
                     RETURNING id, nombre, email, rol, fecha_creacion`;
        params = [this.nombre, this.email, this.rol, this.password, this.id];
      } else {
        queryText = `UPDATE usuarios 
                     SET nombre = $1, email = $2, rol = $3
                     WHERE id = $4 
                     RETURNING id, nombre, email, rol, fecha_creacion`;
        params = [this.nombre, this.email, this.rol, this.id];
      }

      const result = await query(queryText, params);

      if (result.rows.length === 0) {
        throw new Error('Usuario no encontrado para actualizar');
      }

      console.log(`✅ Usuario actualizado: ${this.nombre} (${this.email}) - Rol: ${this.rol}`);
      return this;

    } catch (error) {
      console.error('Error al actualizar usuario:', error.message);
      throw error;
    }
  }

  // Eliminar usuario
  async eliminar() {
    try {
      if (!this.id) {
        throw new Error('No se puede eliminar un usuario sin ID');
      }

      const result = await query(
        'DELETE FROM usuarios WHERE id = $1 RETURNING nombre, email',
        [this.id]
      );

      if (result.rowCount === 0) {
        throw new Error('Usuario no encontrado para eliminar');
      }

      const usuarioEliminado = result.rows[0];
      console.log(`✅ Usuario eliminado: ${usuarioEliminado.nombre} (${usuarioEliminado.email})`);
      return true;

    } catch (error) {
      console.error('Error al eliminar usuario:', error.message);
      throw error;
    }
  }

  // Obtener estadísticas de usuarios por rol
  static async obtenerEstadisticasPorRol() {
    try {
      const result = await query(`
        SELECT 
          rol, 
          COUNT(*) as cantidad,
          COUNT(CASE WHEN fecha_creacion >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevos_ultimo_mes,
          COUNT(CASE WHEN biometric_enabled = true THEN 1 END) as con_biometrico
        FROM usuarios 
        GROUP BY rol 
        ORDER BY cantidad DESC
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw new Error('Error al obtener estadísticas de usuarios');
    }
  }

    // ✅ MÉTODO PARA CAMBIAR CONTRASEÑA
    async cambiarPassword(nuevaPassword) {
        try {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(nuevaPassword, salt);
            
            const query = require('../config/database').query;
            await query(
                'UPDATE usuarios SET password = $1 WHERE id = $2',
                [this.password, this.id]
            );
            
            return this;
        } catch (error) {
            throw new Error('Error al cambiar la contraseña: ' + error.message);
        }
    }

    // ✅ MÉTODO PARA CAMBIAR CONTRASEÑA CON TOKEN (alternativo)
    static async cambiarPasswordConToken(token, nuevaPassword) {
        try {
            const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
            const decoded = jwt.verify(token, JWT_SECRET);
            
            const usuario = await Usuario.obtenerPorId(decoded.userId);
            if (!usuario) {
                throw new Error('Usuario no encontrado');
            }
            
            return await usuario.cambiarPassword(nuevaPassword);
        } catch (error) {
            throw new Error('Error al cambiar contraseña con token: ' + error.message);
        }
    }

    // ✅ MÉTODO PARA VERIFICAR CONTRASEÑA
    async verificarPassword(password) {
        return await bcrypt.compare(password, this.password);
    }

  // Obtener estadísticas biométricas
  static async obtenerEstadisticasBiometricas() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_usuarios,
          COUNT(CASE WHEN biometric_enabled = true THEN 1 END) as biometrico_habilitado,
          COUNT(CASE WHEN pin_hash IS NOT NULL THEN 1 END) as pin_configurado,
          AVG(failed_pin_attempts) as intentos_promedio,
          COUNT(CASE WHEN pin_locked_until > NOW() THEN 1 END) as bloqueados_temporalmente
        FROM usuarios
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error al obtener estadísticas biométricas:', error);
      throw new Error('Error al obtener estadísticas biométricas');
    }
  }

  // Sanitizar datos de salida (remover información sensible)
  toJSON() {
    const { password, pin_hash, ...datosPublicos } = this;
    return datosPublicos;
  }

  // Sanitizar datos biométricos para respuesta segura
  toBiometricJSON() {
    const { password, pin_hash, ...datosPublicos } = this;
    // Incluir información biométrica pero sin el hash del PIN
    return {
      ...datosPublicos,
      tienePIN: !!this.pin_hash,
      biometricEnabled: this.biometric_enabled,
      failedAttempts: this.failed_pin_attempts,
      isLocked: this.estaPINBloqueado(),
      lockedUntil: this.pin_locked_until
    };
  }
}

module.exports = Usuario;
