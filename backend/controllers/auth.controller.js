const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const OTP_EXPIRATION_MINUTES = 5;

// Configura tu transport de nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail', // O tu proveedor
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utilidad para enviar emails
async function sendEmail(to, subject, html) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
}

exports.me = async (req, res) => {
  try {
    const usuario = await Usuario.obtenerPorId(req.user.userId);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    // No envíes la contraseña ni datos sensibles
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

// Registro
exports.register = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    const usuario = new Usuario(null, nombre, email, password, rol);

    // Validar datos
    const errores = usuario.validar();
    if (errores.length > 0) {
      return res.status(400).json({ message: errores.join(', ') });
    }

    // Verificar si ya existe el email
    const usuarioExistente = await Usuario.obtenerPorEmail(email);
    if (usuarioExistente) {
      return res.status(400).json({ message: 'El email ya está registrado.' });
    }

    // Guardar usuario
    await usuario.guardar();
    res.status(201).json({ message: 'Usuario registrado correctamente.' });
  } catch (err) {
    console.error('Error en el registro:', err);
    res.status(500).json({ message: 'Error en el registro.' });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.obtenerPorEmail(email);
    if (!usuario) return res.status(400).json({ message: 'Credenciales inválidas.' });

    const valid = await usuario.verificarPassword(password);
    if (!valid) return res.status(400).json({ message: 'Credenciales inválidas.' });

    // Generar OTP y guardarlo en la base de datos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60000);

    // Actualiza el usuario con OTP y expiración
    await require('../config/database').query(
      'UPDATE usuarios SET otp = $1, otp_expires = $2 WHERE id = $3',
      [otp, otpExpires, usuario.id]
    );

    await sendEmail(
      usuario.email,
      'Tu código de acceso (OTP)',
      `<p>Tu código de acceso es: <b>${otp}</b>. Expira en ${OTP_EXPIRATION_MINUTES} minutos.</p>`
    );

    res.json({ require2fa: true, userId: usuario.id });
  } catch (err) {
    console.error('Error en el login:', err);
    res.status(500).json({ message: 'Error en el login.' });
  }
};

// Verificar OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const result = await require('../config/database').query(
      'SELECT * FROM usuarios WHERE id = $1 AND otp = $2 AND otp_expires > NOW()',
      [userId, otp]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'OTP incorrecto o expirado.' });
    }
    // Limpia el OTP
    await require('../config/database').query(
      'UPDATE usuarios SET otp = NULL, otp_expires = NULL WHERE id = $1',
      [userId]
    );
    const usuario = result.rows[0];
    // Generar JWT
    const token = jwt.sign(
      { userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.json({ token, user: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
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
    const otpExpires = new Date(Date.now() + 15 * 60000); // 15 min

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

    res.json({ message: 'Si el email existe, se enviará un enlace.' });
  } catch (err) {
    console.error('Error enviando email:', err);
    res.status(500).json({ message: 'Error enviando email.' });
  }
};

// Resetear contraseña
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const result = await require('../config/database').query(
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
    await require('../config/database').query(
      'UPDATE usuarios SET password = $1, otp = NULL, otp_expires = NULL WHERE id = $2',
      [usuario.password, usuario.id]
    );
    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('Error actualizando contraseña:', err);
    res.status(500).json({ message: 'Error actualizando contraseña.' });
  }
};