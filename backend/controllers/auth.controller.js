const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const notificationMiddleware = require('../middlewares/notificationMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const OTP_EXPIRATION_MINUTES = 5;
const OFFLINE_CODE_EXPIRATION_MINUTES = 10;

// ✅ ALMACÉN DE SESIONES ACTIVAS (en memoria - para producción usar Redis)
const activeSessions = new Map();

// Configuración de nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ VERIFICACIÓN RÁPIDA DE CONEXIÓN A INTERNET
async function quickInternetCheck() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 1000);

    const socket = require('net').connect({ 
      host: '8.8.8.8', 
      port: 53, 
      timeout: 800 
    });

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });

    socket.on('timeout', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
  });
}

// ✅ VERIFICAR SI EL USUARIO YA TIENE UNA SESIÓN ACTIVA
function checkActiveSession(userId) {
  const session = activeSessions.get(userId);
  if (!session) return null;
  
  const now = Date.now();
  if (now < session.expiresAt) {
    return session;
  } else {
    // Sesión expirada, limpiar
    activeSessions.delete(userId);
    return null;
  }
}

// ✅ AGREGAR SESIÓN ACTIVA
function addActiveSession(userId, token, expiresIn = '1h') {
  const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hora por defecto
  const session = {
    userId,
    token,
    createdAt: Date.now(),
    expiresAt,
    lastActivity: Date.now()
  };
  
  activeSessions.set(userId, session);
  return session;
}

// ✅ ELIMINAR SESIÓN ACTIVA
function removeActiveSession(userId) {
  return activeSessions.delete(userId);
}

// ✅ ACTUALIZAR ACTIVIDAD DE SESIÓN
function updateSessionActivity(userId) {
  const session = activeSessions.get(userId);
  if (session) {
    session.lastActivity = Date.now();
    return true;
  }
  return false;
}

// Utilidad para enviar emails
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    console.log(`✅ Email enviado a: ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return false;
  }
}

// ✅ FUNCIÓN ADMIN RESET PASSWORD MEJORADA CON SOPORTE OFFLINE
exports.adminResetPassword = async (req, res) => {
  try {
    const { userId, email } = req.body;
    const adminId = req.user.userId;

    // Verificar que el usuario que hace la solicitud es admin
    const adminUser = await Usuario.obtenerPorId(adminId);
    if (adminUser.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden restablecer contraseñas'
      });
    }

     // Si se proporciona email, validar formato
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de email inválido. Debe ser un email válido (ejemplo@gmail.com)'
        });
      }
    }

    // Buscar el usuario objetivo por ID o email
    let targetUser;
    if (userId) {
      targetUser = await Usuario.obtenerPorId(userId);
    } else if (email) {
      targetUser = await Usuario.obtenerPorEmail(email);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere userId o email del usuario'
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Generar token de restablecimiento
    const resetToken = jwt.sign(
      { 
        userId: targetUser.id, 
        type: 'password_reset',
        timestamp: Date.now(),
        adminRequest: true 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const hasInternet = await quickInternetCheck();
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    let emailSent = false;
    let consoleCode = '';

    if (hasInternet) {
      // Intentar enviar email
      emailSent = await sendEmail(
        targetUser.email,
        'Restablecimiento de contraseña solicitado por administrador',
        `<p>Un administrador ha solicitado el restablecimiento de tu contraseña.</p>
         <p>Haz clic <a href="${resetLink}">aquí</a> para crear una nueva contraseña.</p>
         <p>Este enlace expira en 1 hora.</p>
         <p><strong>Token alternativo (para uso offline):</strong> ${resetToken}</p>`
      );
    }

    // Siempre generar código para consola (modo offline)
    consoleCode = resetToken;
    
    console.log('🔐 ADMIN RESET PASSWORD SOLICITADO');
    console.log(`👤 Admin: ${adminUser.nombre} (${adminUser.email})`);
    console.log(`🎯 Usuario objetivo: ${targetUser.nombre} (${targetUser.email})`);
    console.log(`🌐 Estado conexión: ${hasInternet ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`📧 Email enviado: ${emailSent ? 'SÍ' : 'NO'}`);
    console.log(`🔗 Enlace de restablecimiento: ${resetLink}`);
    console.log(`🔑 Token para consola: ${consoleCode}`);
    console.log('⏰ Expira en: 1 hora');

    res.json({
      success: true,
      message: `Solicitud de restablecimiento procesada para ${targetUser.email}`,
      data: {
        userId: targetUser.id,
        email: targetUser.email,
        internet: hasInternet,
        emailSent: emailSent,
        resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined,
        token: process.env.NODE_ENV === 'development' ? consoleCode : undefined,
        mode: hasInternet ? 'online' : 'offline'
      }
    });

  } catch (error) {
    console.error('❌ Error en adminResetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud de restablecimiento'
    });
  }
};

// ✅ FUNCIÓN FORGOT PASSWORD MEJORADA CON SOPORTE OFFLINE Y VALIDACIÓN DE EMAIL
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validar que se proporcionó un email
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'El email es requerido'
      });
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Formato de email inválido. Debe ser un email válido (ejemplo@gmail.com)'
      });
    }
    
    // Validar dominios específicos si lo deseas (opcional)
    const allowedDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
    const emailDomain = email.split('@')[1];
    
    if (!allowedDomains.includes(emailDomain)) {
      return res.status(400).json({ 
        success: false,
        message: 'Dominio de email no permitido. Use @gmail.com, @hotmail.com, etc.'
      });
    }
    
    const usuario = await Usuario.obtenerPorEmail(email);
    
    // Por seguridad, siempre devolver éxito aunque el email no exista
    if (!usuario) {
      return res.status(200).json({ 
        success: true,
        message: 'Si el email existe, se enviará un enlace de restablecimiento',
        data: {
          emailExists: false,
          emailValid: true,
          domainValid: true
        }
      });
    }

    // Generar token de restablecimiento
    const resetToken = jwt.sign(
      { 
        userId: usuario.id, 
        type: 'password_reset',
        timestamp: Date.now() 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const hasInternet = await quickInternetCheck();
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    let emailSent = false;
    let consoleCode = '';

    if (hasInternet) {
      // Intentar enviar email
      emailSent = await sendEmail(
        usuario.email,
        'Recuperación de contraseña',
        `<p>Has solicitado el restablecimiento de tu contraseña.</p>
         <p>Haz clic <a href="${resetLink}">aquí</a> para crear una nueva contraseña.</p>
         <p>Este enlace expira en 1 hora.</p>
         <p><strong>Token alternativo (para uso offline):</strong> ${resetToken}</p>`
      );
    }

    // Siempre generar código para consola (modo offline)
    consoleCode = resetToken;
    
    console.log('🔐 FORGOT PASSWORD SOLICITADO');
    console.log(`👤 Usuario: ${usuario.nombre} (${usuario.email})`);
    console.log(`🌐 Estado conexión: ${hasInternet ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`📧 Email enviado: ${emailSent ? 'SÍ' : 'NO'}`);
    console.log(`🔗 Enlace de restablecimiento: ${resetLink}`);
    console.log(`🔑 Token para consola: ${consoleCode}`);
    console.log('⏰ Expira en: 1 hora');

    // Notificar solicitud de recuperación
    await notificationMiddleware.onSuspiciousActivity(usuario.id, {
      tipo: 'recuperacion_password_solicitada',
      timestamp: new Date().toISOString(),
      ip: req.ip,
      modo: hasInternet ? 'online' : 'offline'
    });

    res.json({ 
      success: true,
      message: 'Si el email existe, se enviará un enlace de restablecimiento',
      data: {
        emailExists: true,
        emailValid: true,
        domainValid: true,
        internet: hasInternet,
        emailSent: emailSent,
        resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined,
        token: process.env.NODE_ENV === 'development' ? consoleCode : undefined,
        mode: hasInternet ? 'online' : 'offline'
      }
    });

  } catch (err) {
    console.error('❌ Error en forgotPassword:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error procesando la solicitud' 
    });
  }
};

// ✅ RESET PASSWORD MEJORADO
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token y nueva contraseña son requeridos'
      });
    }

    // Verificar el token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Verificar que es un token de restablecimiento
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Token no válido para restablecimiento'
      });
    }

    // Cambiar la contraseña
    const usuario = await Usuario.obtenerPorId(decoded.userId);
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    await usuario.cambiarPassword(password);

    console.log('✅ CONTRASEÑA RESTABLECIDA EXITOSAMENTE');
    console.log(`👤 Usuario: ${usuario.nombre} (${usuario.email})`);
    console.log(`🕒 Fecha: ${new Date().toLocaleString()}`);

    // Notificar cambio de contraseña exitoso
    await notificationMiddleware.onSuspiciousActivity(usuario.id, {
      tipo: 'password_actualizado',
      timestamp: new Date().toISOString(),
      ip: req.ip
    });
    
    res.json({ 
      success: true,
      message: 'Contraseña actualizada correctamente' 
    });

  } catch (err) {
    console.error('❌ Error actualizando contraseña:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Error actualizando contraseña' 
    });
  }
};

// Obtener usuario autenticado
exports.me = async (req, res) => {
  try {
    const usuario = await Usuario.obtenerPorId(req.user.userId);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    // Actualizar actividad de la sesión
    updateSessionActivity(req.user.userId);
    
    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuario autenticado' });
  }
};

// Registro de usuario con validación de email
exports.register = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Formato de email inválido. Debe ser un email válido (ejemplo@gmail.com)' 
      });
    }
    
    // Validar dominios específicos
    const allowedDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
    const emailDomain = email.split('@')[1];
    
    if (!allowedDomains.includes(emailDomain)) {
      return res.status(400).json({ 
        message: 'Dominio de email no permitido. Use @gmail.com, @hotmail.com, etc.' 
      });
    }
    
    const usuario = new Usuario(null, nombre, email, password, rol);

    const errores = usuario.validar();
    if (errores.length > 0) {
      return res.status(400).json({ message: errores.join(', ') });
    }

    const usuarioExistente = await Usuario.obtenerPorEmail(email);
    if (usuarioExistente) {
      return res.status(400).json({ message: 'El email ya está registrado.' });
    }

    await usuario.guardar();

    // Notificación de bienvenida
    await notificationMiddleware.onSystemUpdate({
      message: `Bienvenido ${usuario.nombre}! Tu cuenta ha sido creada exitosamente.`,
      tipo: 'bienvenida'
    });

    res.status(201).json({ message: 'Usuario registrado correctamente.' });
  } catch (err) {
    console.error('Error en el registro:', err);
    res.status(500).json({ message: 'Error en el registro.' });
  }
};

// ✅ LOGIN CON CONTROL DE SESIONES ACTIVAS
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar entrada básica
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email y contraseña son requeridos' 
      });
    }

    const usuario = await Usuario.obtenerPorEmail(email);
    if (!usuario) {
      return res.status(400).json({ 
        success: false,
        message: 'Credenciales inválidas.' 
      });
    }

    const valid = await usuario.verificarPassword(password);
    if (!valid) {
      await notificationMiddleware.onSuspiciousActivity(usuario.id, {
        tipo: 'intento_login_fallido',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({ 
        success: false,
        message: 'Credenciales inválidas.' 
      });
    }

    // ✅ VERIFICAR SI YA EXISTE UNA SESIÓN ACTIVA
    const existingSession = checkActiveSession(usuario.id);
    if (existingSession) {
      const timeLeft = Math.max(0, existingSession.expiresAt - Date.now());
      const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
      
      console.log(`⚠️  Sesión activa detectada para usuario: ${usuario.email}`);
      console.log(`⏰ La sesión actual expira en: ${minutesLeft} minutos`);
      
      return res.status(409).json({
        success: false,
        message: `Ya existe una sesión activa para este usuario`,
        data: {
          sessionActive: true,
          expiresIn: minutesLeft,
          message: `Tu sesión actual expira en ${minutesLeft} minutos. Espera a que expire o cierra la sesión actual.`
        }
      });
    }

    console.log(`🔐 Login iniciado para: ${usuario.email}`);
    const startTime = Date.now();

    // ✅ VERIFICACIÓN ULTRARRÁPIDA DE CONEXIÓN
    const hasInternet = await quickInternetCheck();
    const connectionCheckTime = Date.now() - startTime;
    
    console.log(`⚡ Verificación de conexión: ${connectionCheckTime}ms`);
    console.log(`🌐 Estado: ${hasInternet ? 'ONLINE' : 'OFFLINE'}`);

    const query = require('../config/database').query;

    if (hasInternet) {
      // MODO ONLINE - Proceso normal
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60000);

      await query(
        'UPDATE usuarios SET otp = $1, otp_expires = $2 WHERE id = $3',
        [otp, otpExpires, usuario.id]
      );

      // Enviar email de forma asíncrona (no esperar respuesta)
      sendEmail(
        usuario.email,
        'Tu código de acceso (OTP)',
        `<p>Tu código de acceso es: <b>${otp}</b>. Expira en ${OTP_EXPIRATION_MINUTES} minutos.</p>`
      ).then(sent => {
        console.log(sent ? '📧 Email enviado' : '❌ Error enviando email');
      });

      await notificationMiddleware.onSuspiciousActivity(usuario.id, {
        tipo: 'login_exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        modo: 'online'
      });

      const totalTime = Date.now() - startTime;
      console.log(`✅ Login ONLINE completado en: ${totalTime}ms`);

      res.json({ 
        success: true,
        require2fa: true, 
        userId: usuario.id,
        mode: 'online',
        responseTime: totalTime,
        message: 'Código enviado por correo electrónico'
      });
      
    } else {
      // ✅ MODO OFFLINE - PROCESO ACELERADO
      const offlineCode = Math.floor(1000 + Math.random() * 9000).toString();
      const codeHash = await bcrypt.hash(offlineCode, 8); // Salt más bajo para mayor velocidad
      const codeExpires = new Date(Date.now() + OFFLINE_CODE_EXPIRATION_MINUTES * 60000);
      
      // Actualización rápida en base de datos
      await query(
        'UPDATE usuarios SET offline_code_hash = $1, offline_code_expires = $2 WHERE id = $3',
        [codeHash, codeExpires, usuario.id]
      );

      const showCode = process.env.NODE_ENV === 'development';
      
      await notificationMiddleware.onSuspiciousActivity(usuario.id, {
        tipo: 'login_exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        modo: 'offline'
      });

      const totalTime = Date.now() - startTime;
      console.log(`✅ Login OFFLINE completado en: ${totalTime}ms`);

      res.json({ 
        success: true,
        require2fa: true, 
        userId: usuario.id,
        mode: 'offline',
        responseTime: totalTime,
        offlineCode: showCode ? offlineCode : undefined,
        message: showCode 
          ? `Modo offline. Tu código: ${offlineCode} (expira en ${OFFLINE_CODE_EXPIRATION_MINUTES} min)`
          : 'Modo offline activado. Revisa la aplicación para el código de acceso.'
      });
    }
    
  } catch (err) {
    console.error('❌ Error en el login:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error en el login.' 
    });
  }
};

// ✅ VERIFICACIÓN OTP CON REGISTRO DE SESIÓN
exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const startTime = Date.now();
    
    if (!userId || !otp) {
      return res.status(400).json({ 
        success: false,
        message: 'UserId y código OTP son requeridos' 
      });
    }

    const query = require('../config/database').query;
    
    const result = await query(
      `SELECT id, nombre, email, rol, otp, otp_expires, offline_code_hash, offline_code_expires 
       FROM usuarios WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Usuario no encontrado.' 
      });
    }
    
    const usuario = result.rows[0];
    let isValid = false;
    let mode = 'online';
    const now = new Date();
    
    // Verificación rápida de OTP online
    if (usuario.otp === otp && new Date(usuario.otp_expires) > now) {
      isValid = true;
      mode = 'online';
    } 
    // Verificación rápida de código offline
    else if (usuario.offline_code_hash && new Date(usuario.offline_code_expires) > now) {
      isValid = await bcrypt.compare(otp, usuario.offline_code_hash);
      mode = 'offline';
    }
    
    if (!isValid) {
      await notificationMiddleware.onSuspiciousActivity(usuario.id, {
        tipo: 'otp_invalido',
        ip: req.ip,
        timestamp: new Date().toISOString(),
        modo: mode
      });
      
      return res.status(400).json({ 
        success: false,
        message: 'Código incorrecto o expirado.' 
      });
    }
    
    // Limpiar códigos usados
    await query(
      'UPDATE usuarios SET otp = NULL, otp_expires = NULL, offline_code_hash = NULL, offline_code_expires = NULL WHERE id = $1',
      [userId]
    );
    
    const tokenExpiresIn = mode === 'offline' ? '2h' : '1d';
    
    const token = jwt.sign(
      { 
        userId: usuario.id, 
        rol: usuario.rol, 
        nombre: usuario.nombre, 
        email: usuario.email,
        authMode: mode
      },
      JWT_SECRET,
      { expiresIn: tokenExpiresIn }
    );

    // ✅ REGISTRAR NUEVA SESIÓN ACTIVA
    addActiveSession(usuario.id, token, tokenExpiresIn);
    
    console.log(`✅ Nueva sesión registrada para: ${usuario.email}`);
    console.log(`🔐 Modo: ${mode}`);
    console.log(`⏰ Expira en: ${tokenExpiresIn}`);

    await notificationMiddleware.onSuspiciousActivity(usuario.id, {
      tipo: 'verificacion_exitosa',
      timestamp: new Date().toISOString(),
      modo: mode
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Verificación OTP ${mode} completada en: ${totalTime}ms`);
    
    res.json({ 
      success: true,
      token, 
      user: { 
        id: usuario.id,
        nombre: usuario.nombre, 
        email: usuario.email, 
        rol: usuario.rol 
      },
      mode,
      responseTime: totalTime,
      message: mode === 'offline' ? 'Autenticación offline exitosa' : 'Autenticación exitosa'
    });
    
  } catch (err) {
    console.error('❌ Error verificando OTP:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error verificando OTP.' 
    });
  }
};

// ✅ LOGOUT - ELIMINAR SESIÓN ACTIVA
exports.logout = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Eliminar sesión activa
    const removed = removeActiveSession(userId);
    
    if (removed) {
      console.log(`✅ Sesión eliminada para usuario ID: ${userId}`);
    }
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
    
  } catch (err) {
    console.error('❌ Error en logout:', err);
    res.status(500).json({
      success: false,
      message: 'Error cerrando sesión'
    });
  }
};

// ✅ VERIFICAR ESTADO DE SESIÓN
exports.checkSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const session = checkActiveSession(userId);
    
    if (session) {
      const timeLeft = session.expiresAt - Date.now();
      const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
      
      res.json({
        success: true,
        sessionActive: true,
        data: {
          userId: session.userId,
          createdAt: new Date(session.createdAt).toISOString(),
          lastActivity: new Date(session.lastActivity).toISOString(),
          expiresAt: new Date(session.expiresAt).toISOString(),
          expiresIn: minutesLeft,
          timeLeft: timeLeft
        }
      });
    } else {
      res.json({
        success: true,
        sessionActive: false,
        message: 'No hay sesión activa'
      });
    }
    
  } catch (err) {
    console.error('❌ Error verificando sesión:', err);
    res.status(500).json({
      success: false,
      message: 'Error verificando sesión'
    });
  }
};

// ✅ ENDPOINT PARA FORZAR CIERRE DE SESIÓN (admin)
exports.forceLogout = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'UserId es requerido'
      });
    }
    
    // Verificar que el usuario que hace la solicitud es admin
    const adminUser = await Usuario.obtenerPorId(req.user.userId);
    if (adminUser.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden forzar cierre de sesión'
      });
    }
    
    const targetUser = await Usuario.obtenerPorId(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Eliminar sesión activa
    const removed = removeActiveSession(userId);
    
    await notificationMiddleware.onSuspiciousActivity(userId, {
      tipo: 'sesion_forzada_cerrada',
      timestamp: new Date().toISOString(),
      administrador: adminUser.nombre
    });
    
    res.json({
      success: true,
      message: `Sesión forzada cerrada para ${targetUser.email}`,
      data: {
        userId: userId,
        email: targetUser.email,
        sessionRemoved: removed
      }
    });
    
  } catch (err) {
    console.error('❌ Error forzando logout:', err);
    res.status(500).json({
      success: false,
      message: 'Error forzando cierre de sesión'
    });
  }
};

// Verificar token JWT
exports.verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const query = require('../config/database').query;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Actualizar actividad de sesión si existe
    updateSessionActivity(decoded.userId);
    
    const userResult = await query(
      'SELECT id, nombre, email FROM usuarios WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: userResult.rows[0],
      authMode: decoded.authMode || 'online'
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

// ✅ MÉTODO PARA OBTENER ESTADÍSTICAS DE SESIONES (admin)
exports.getSessionsStats = async (req, res) => {
  try {
    // Verificar que el usuario es admin
    const adminUser = await Usuario.obtenerPorId(req.user.userId);
    if (adminUser.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden ver estadísticas de sesiones'
      });
    }
    
    const now = Date.now();
    const activeSessionsCount = activeSessions.size;
    
    // Filtrar sesiones activas (no expiradas)
    const trulyActiveSessions = Array.from(activeSessions.entries())
      .filter(([userId, session]) => now < session.expiresAt)
      .map(([userId, session]) => ({
        userId,
        createdAt: new Date(session.createdAt).toISOString(),
        lastActivity: new Date(session.lastActivity).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
        expiresIn: Math.ceil((session.expiresAt - now) / (60 * 1000))
      }));
    
    res.json({
      success: true,
      data: {
        totalSessions: activeSessionsCount,
        activeSessions: trulyActiveSessions.length,
        sessions: trulyActiveSessions,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ Error obteniendo estadísticas de sesiones:', err);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas de sesiones'
    });
  }
};