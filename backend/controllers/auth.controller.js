const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const notificationMiddleware = require('../middlewares/notificationMiddleware'); // ← NUEVO

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const OTP_EXPIRATION_MINUTES = 5;
const OFFLINE_CODE_EXPIRATION_MINUTES = 10;

// Configuración de nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw new Error('Error enviando email');
  }
}

// Verificar conexión a internet
async function checkInternetConnection() {
  try {
    await dns.resolve('google.com');
    return true;
  } catch (error) {
    console.log('🌐 Modo offline detectado');
    return false;
  }
}

// Obtener usuario autenticado
exports.me = async (req, res) => {
  try {
    const usuario = await Usuario.obtenerPorId(req.user.userId);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    
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

// Registro de usuario
exports.register = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
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

    // Notificación de bienvenida ← NUEVO
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

// Login con soporte online/offline
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.obtenerPorEmail(email);
    if (!usuario) return res.status(400).json({ message: 'Credenciales inválidas.' });

    const valid = await usuario.verificarPassword(password);
    if (!valid) {
      // Notificar actividad sospechosa por intento fallido ← NUEVO
      await notificationMiddleware.onSuspiciousActivity(usuario.id, {
        tipo: 'intento_login_fallido',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    const hasInternet = await checkInternetConnection();
    const query = require('../config/database').query;

    if (hasInternet) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60000);

      await query(
        'UPDATE usuarios SET otp = $1, otp_expires = $2 WHERE id = $3',
        [otp, otpExpires, usuario.id]
      );

      await sendEmail(
        usuario.email,
        'Tu código de acceso (OTP)',
        `<p>Tu código de acceso es: <b>${otp}</b>. Expira en ${OTP_EXPIRATION_MINUTES} minutos.</p>`
      );

      // Notificar inicio de sesión ← NUEVO
      await notificationMiddleware.onSuspiciousActivity(usuario.id, {
        tipo: 'login_exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        modo: 'online'
      });

      res.json({ 
        require2fa: true, 
        userId: usuario.id,
        mode: 'online',
        message: 'Código enviado por correo electrónico'
      });
      
    } else {
      const offlineCode = Math.floor(1000 + Math.random() * 9000).toString();
      const codeHash = await bcrypt.hash(offlineCode, 10);
      const codeExpires = new Date(Date.now() + OFFLINE_CODE_EXPIRATION_MINUTES * 60000);
      
      await query(
        'UPDATE usuarios SET offline_code_hash = $1, offline_code_expires = $2 WHERE id = $3',
        [codeHash, codeExpires, usuario.id]
      );

      const showCode = process.env.NODE_ENV === 'development';
      
      // Notificar inicio de sesión offline ← NUEVO
      await notificationMiddleware.onSuspiciousActivity(usuario.id, {
        tipo: 'login_exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        modo: 'offline'
      });

      res.json({ 
        require2fa: true, 
        userId: usuario.id,
        mode: 'offline',
        offlineCode: showCode ? offlineCode : undefined,
        message: showCode 
          ? `Modo offline. Tu código: ${offlineCode} (expira en ${OFFLINE_CODE_EXPIRATION_MINUTES} min)`
          : 'Modo offline activado. Revisa la aplicación para el código de acceso.'
      });
    }
    
  } catch (err) {
    console.error('Error en el login:', err);
    res.status(500).json({ message: 'Error en el login.' });
  }
};

// Verificación OTP mejorada para online/offline
exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const query = require('../config/database').query;
    
    const result = await query(
      `SELECT * FROM usuarios WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Usuario no encontrado.' });
    }
    
    const usuario = result.rows[0];
    let isValid = false;
    let mode = 'online';
    const now = new Date();
    
    if (usuario.otp === otp && new Date(usuario.otp_expires) > now) {
      isValid = true;
      mode = 'online';
    } else if (usuario.offline_code_hash && new Date(usuario.offline_code_expires) > now) {
      isValid = await bcrypt.compare(otp, usuario.offline_code_hash);
      mode = 'offline';
    }
    
    if (!isValid) {
      // Notificar intento de OTP inválido ← NUEVO
      await notificationMiddleware.onSuspiciousActivity(usuario.id, {
        tipo: 'otp_invalido',
        ip: req.ip,
        timestamp: new Date().toISOString(),
        modo: mode
      });
      
      return res.status(400).json({ message: 'Código incorrecto o expirado.' });
    }
    
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

    // Notificar verificación exitosa ← NUEVO
    await notificationMiddleware.onSuspiciousActivity(usuario.id, {
      tipo: 'verificacion_exitosa',
      timestamp: new Date().toISOString(),
      modo: mode
    });
    
    res.json({ 
      token, 
      user: { 
        nombre: usuario.nombre, 
        email: usuario.email, 
        rol: usuario.rol 
      },
      mode,
      message: mode === 'offline' ? 'Autenticación offline exitosa' : 'Autenticación exitosa'
    });
    
  } catch (err) {
    console.error('Error verificando OTP:', err);
    res.status(500).json({ message: 'Error verificando OTP.' });
  }
};

// Solicitar recuperación de contraseña
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const usuario = await Usuario.obtenerPorEmail(email);
    if (!usuario) return res.status(200).json({ message: 'Si el email existe, se enviará un enlace.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const otpExpires = new Date(Date.now() + 15 * 60000);

    await require('../config/database').query(
      'UPDATE usuarios SET otp = $1, otp_expires = $2 WHERE id = $3',
      [resetToken, otpExpires, usuario.id]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendEmail(
      usuario.email,
      'Recupera tu contraseña',
      `<p>Haz clic <a href="${resetUrl}">aquí</a> para restablecer tu contraseña. El enlace expira en 15 minutos.</p>`
    );

    // Notificar solicitud de recuperación ← NUEVO
    await notificationMiddleware.onSuspiciousActivity(usuario.id, {
      tipo: 'recuperacion_password_solicitada',
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({ message: 'Si el email existe, se enviará un enlace.' });
  } catch (err) {
    console.error('Error enviando email:', err);
    res.status(500).json({ message: 'Error enviando email.' });
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

// Resetear contraseña
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const query = require('../config/database').query;
    
    const result = await query(
      'SELECT * FROM usuarios WHERE otp = $1 AND otp_expires > NOW()',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Token inválido o expirado.' });
    }
    
    const usuario = new Usuario();
    Object.assign(usuario, result.rows[0]);
    usuario.password = password;
    await usuario.encriptarPassword();
    
    await query(
      'UPDATE usuarios SET password = $1, otp = NULL, otp_expires = NULL WHERE id = $2',
      [usuario.password, usuario.id]
    );

    // Notificar cambio de contraseña exitoso ← NUEVO
    await notificationMiddleware.onSuspiciousActivity(usuario.id, {
      tipo: 'password_actualizado',
      timestamp: new Date().toISOString(),
      ip: req.ip
    });
    
    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('Error actualizando contraseña:', err);
    res.status(500).json({ message: 'Error actualizando contraseña.' });
  }
};