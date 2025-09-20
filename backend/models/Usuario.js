const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

class Usuario {
  constructor(id = null, nombre = '', email = '', password = '', rol = '', otp = null, otp_expires = null, proveedor = null) {
    this.id = id;
    this.nombre = nombre;
    this.email = email;
    this.password = password;
    this.rol = rol;
    this.fecha_creacion = null;
    this.otp = otp;
    this.otp_expires = otp_expires;
    this.proveedor = proveedor; // <--- nuevo campo
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
      }
    };
  }

  // Obtener todos los usuarios
  static async obtenerTodos() {
    try {
      const result = await query(
        'SELECT id, nombre, email, rol, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC'
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

  // Obtener usuario por ID
  static async obtenerPorId(id) {
    try {
      // Validar ID
      if (!Usuario.validarId(id)) {
        throw new Error('ID de usuario inválido');
      }

      const result = await query(
        'SELECT id, nombre, email, rol, fecha_creacion FROM usuarios WHERE id = $1',
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

  // Obtener usuario por email
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

  // Validar ID
  static validarId(id) {
    if (!id) return false;
    const numId = parseInt(id);
    return !isNaN(numId) && numId > 0 && Number.isInteger(numId);
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

  // Verificar contraseña
  async verificarPassword(passwordPlano) {
    if (!this.password || !passwordPlano) {
      return false;
    }
    return await bcrypt.compare(passwordPlano, this.password);
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

    // Insertar en base de datos (agrega proveedor)
    const result = await query(
      `INSERT INTO usuarios (nombre, email, password, rol, proveedor) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, nombre, email, rol, fecha_creacion, proveedor`,
      [this.nombre, this.email, this.password || null, this.rol, this.proveedor || null]
    );

    // Actualizar objeto con datos devueltos
    const usuarioGuardado = result.rows[0];
    this.id = usuarioGuardado.id;
    this.fecha_creacion = usuarioGuardado.fecha_creacion;
    this.proveedor = usuarioGuardado.proveedor;

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
          COUNT(CASE WHEN fecha_creacion >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevos_ultimo_mes
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

  // Sanitizar datos de salida (remover información sensible)
  toJSON() {
    const { password, ...datosPublicos } = this;
    return datosPublicos;
  }
}

module.exports = Usuario;