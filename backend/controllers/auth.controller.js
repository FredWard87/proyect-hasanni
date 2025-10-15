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

// ✅ LISTA DE CONTRASEÑAS COMUNES/VULNERABLES
const COMMON_PASSWORDS = [
  '123456', 'password', '123456789', '12345678', '12345', '1234567', 
  '1234567890', 'qwerty', 'abc123', 'million2', '000000', '1234',
  'iloveyou', 'aaron431', 'password1', 'qqww1122', '123123', 'omgpop',
  '123321', '654321', 'qwertyuiop', 'qwer1234', '123abc', 'Password',
  'admin', 'administrator', 'root', 'toor', 'pass', 'test', 'guest',
  'user', 'demo', 'sample', 'default', 'changeme', 'welcome', 'login',
  'master', 'super', 'secret', 'qwerty123', 'letmein', 'monkey',
  'dragon', 'sunshine', 'princess', 'football', 'charlie', 'aa123456',
  'donald', 'freedom', 'love', '696969', '1q2w3e4r', '1qaz2wsx',
  'baseball', 'hello', 'jordan', 'michelle', 'computer', 'superman'
];

// ✅ PATRONES DE CONTRASEÑAS DÉBILES
const WEAK_PATTERNS = [
  /^(.)\1+$/, // Caracteres repetidos (aaaa, 1111)
  /^(012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210)+/, // Secuencias numéricas
  /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+/i, // Secuencias alfabéticas
  /^(qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)+/i, // Patrones de teclado
  /^(password|contraseña|clave|key|pass|pwd)+/i, // Palabras relacionadas con contraseña
  /^(admin|administrator|root|user|guest|test|demo)+/i, // Nombres de usuario comunes
  /^(19|20)\d{2}/, // Años (1900-2099)
  /^\d+$/, // Solo números
  /^[a-zA-Z]+$/, // Solo letras
  /^(.{1,3})\1+$/ // Patrones cortos repetidos (abcabc)
];

// ✅ EXPRESIONES REGULARES PARA VALIDACIÓN DE FORMATOS
const FORMAT_VALIDATORS = {
  // Validación de email estricta
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  
  // Validación de nombre (solo letras, espacios, acentos y longitud razonable)
  nombre: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]{2,50}$/,
  
  // Validación de token JWT (formato básico)
  jwtToken: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  
  // Validación de OTP (6 dígitos)
  otp: /^\d{6}$/,
  
  // Validación de código offline (4 dígitos)
  offlineCode: /^\d{4}$/,
  
  // Validación de ID numérico
  numericId: /^\d+$/,
  
  // Validación de coordenadas geográficas
  latitude: /^-?(90(\.0{1,6})?|[1-8]?\d(\.\d{1,6})?)$/,
  longitude: /^-?(180(\.0{1,6})?|1[0-7]\d(\.\d{1,6})?|\d{1,2}(\.\d{1,6})?)$/,
  
  // Validación de precisión de ubicación
  accuracy: /^\d+(\.\d{1,2})?$/,
  
  // Validación de timestamp ISO
  isoTimestamp: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
  
  // Validación de rol de usuario
  rol: /^(admin|lector|editor|supervisor)$/,
  
  // Validación de longitud de contraseña
  passwordLength: /^.{8,128}$/,
  
  // Validación de URL (básica)
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/,
  
  // Validación de IP address
  ipAddress: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  
  // Validación de user agent (básica)
  userAgent: /^.{1,500}$/,
  
  // Validación de dominio de email
  emailDomain: /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
};

// ✅ FUNCIÓN PARA VALIDAR FORMATOS
function validateFormat(value, type, fieldName = 'Campo') {
  if (value === undefined || value === null) {
    return { isValid: false, error: `${fieldName} es requerido` };
  }
  
  // Convertir a string para validaciones de texto
  const stringValue = String(value).trim();
  
  if (stringValue === '') {
    return { isValid: false, error: `${fieldName} no puede estar vacío` };
  }
  
  switch (type) {
    case 'email':
      if (!FORMAT_VALIDATORS.email.test(stringValue)) {
        return { isValid: false, error: `${fieldName} tiene un formato de email inválido` };
      }
      break;
      
    case 'nombre':
      if (!FORMAT_VALIDATORS.nombre.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe contener solo letras y espacios (2-50 caracteres)` };
      }
      break;
      
    case 'jwtToken':
      if (!FORMAT_VALIDATORS.jwtToken.test(stringValue)) {
        return { isValid: false, error: `${fieldName} tiene un formato de token inválido` };
      }
      break;
      
    case 'otp':
      if (!FORMAT_VALIDATORS.otp.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser un código de 6 dígitos` };
      }
      break;
      
    case 'offlineCode':
      if (!FORMAT_VALIDATORS.offlineCode.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser un código de 4 dígitos` };
      }
      break;
      
    case 'numericId':
      if (!FORMAT_VALIDATORS.numericId.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser un número válido` };
      }
      break;
      
    case 'latitude':
      if (!FORMAT_VALIDATORS.latitude.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser una latitud válida (-90 a 90)` };
      }
      break;
      
    case 'longitude':
      if (!FORMAT_VALIDATORS.longitude.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser una longitud válida (-180 a 180)` };
      }
      break;
      
    case 'accuracy':
      if (!FORMAT_VALIDATORS.accuracy.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser un valor de precisión válido` };
      }
      break;
      
    case 'isoTimestamp':
      if (!FORMAT_VALIDATORS.isoTimestamp.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser una fecha ISO válida` };
      }
      break;
      
    case 'rol':
      if (!FORMAT_VALIDATORS.rol.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser un rol válido (admin, lector, editor, supervisor)` };
      }
      break;
      
    case 'password':
      if (!FORMAT_VALIDATORS.passwordLength.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe tener entre 8 y 128 caracteres` };
      }
      break;
      
    case 'url':
      if (!FORMAT_VALIDATORS.url.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser una URL válida` };
      }
      break;
      
    case 'ipAddress':
      if (!FORMAT_VALIDATORS.ipAddress.test(stringValue)) {
        return { isValid: false, error: `${fieldName} debe ser una dirección IP válida` };
      }
      break;
      
    case 'userAgent':
      if (!FORMAT_VALIDATORS.userAgent.test(stringValue)) {
        return { isValid: false, error: `${fieldName} excede la longitud máxima permitida` };
      }
      break;
      
    case 'emailDomain':
      if (!FORMAT_VALIDATORS.emailDomain.test(stringValue)) {
        return { isValid: false, error: `${fieldName} tiene un formato de dominio inválido` };
      }
      break;
      
    default:
      return { isValid: true, error: null };
  }
  
  return { isValid: true, error: null };
}

// ✅ FUNCIÓN PARA VALIDAR OBJETOS COMPLETOS
function validateRequestBody(body, validations) {
  const errors = [];
  
  for (const [field, config] of Object.entries(validations)) {
    const { type, required = true, min, max, custom } = config;
    
    // Verificar campos requeridos
    if (required && (body[field] === undefined || body[field] === null)) {
      errors.push(`${field} es requerido`);
      continue;
    }
    
    // Si el campo no es requerido y está vacío, continuar
    if (!required && (body[field] === undefined || body[field] === null || body[field] === '')) {
      continue;
    }
    
    // Validar formato básico
    if (type) {
      const formatValidation = validateFormat(body[field], type, field);
      if (!formatValidation.isValid) {
        errors.push(formatValidation.error);
        continue;
      }
    }
    
    // Validaciones de longitud para strings
    if (typeof body[field] === 'string') {
      const value = body[field].trim();
      
      if (min !== undefined && value.length < min) {
        errors.push(`${field} debe tener al menos ${min} caracteres`);
      }
      
      if (max !== undefined && value.length > max) {
        errors.push(`${field} no puede tener más de ${max} caracteres`);
      }
    }
    
    // Validaciones numéricas
    if (typeof body[field] === 'number' || !isNaN(body[field])) {
      const numValue = parseFloat(body[field]);
      
      if (min !== undefined && numValue < min) {
        errors.push(`${field} debe ser mayor o igual a ${min}`);
      }
      
      if (max !== undefined && numValue > max) {
        errors.push(`${field} debe ser menor o igual a ${max}`);
      }
    }
    
    // Validación personalizada
    if (custom) {
      const customValidation = custom(body[field]);
      if (!customValidation.isValid) {
        errors.push(customValidation.error);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    validatedData: body
  };
}

// ✅ FUNCIÓN ULTRA ROBUSTA PARA VALIDAR FORTALEZA DE CONTRASEÑA
function validatePasswordStrength(password, userInfo = {}) {
  const errors = [];
  const warnings = [];
  let score = 0;
  
  // ========== VALIDACIONES BÁSICAS ==========
  
  // Verificar que existe
  if (!password) {
    errors.push('La contraseña es requerida');
    return { isValid: false, errors, warnings, score: 0, strength: 'invalid' };
  }
  
  // Verificar tipo de dato
  if (typeof password !== 'string') {
    errors.push('La contraseña debe ser una cadena de texto');
    return { isValid: false, errors, warnings, score: 0, strength: 'invalid' };
  }
  
  // Validar formato básico de longitud
  const lengthValidation = validateFormat(password, 'password', 'Contraseña');
  if (!lengthValidation.isValid) {
    errors.push(lengthValidation.error);
    return { isValid: false, errors, warnings, score: 0, strength: 'invalid' };
  }
  
  // ========== VALIDACIONES DE COMPOSICIÓN ==========
  
  // Al menos una letra mayúscula
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula (A-Z)');
  } else {
    score += 10;
  }
  
  // Al menos una letra minúscula
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula (a-z)');
  } else {
    score += 10;
  }
  
  // Al menos un número
  if (!/\d/.test(password)) {
    errors.push('La contraseña debe contener al menos un número (0-9)');
  } else {
    score += 10;
  }
  
  // Al menos un carácter especial
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  } else {
    score += 15;
  }
  
  // ========== VALIDACIONES AVANZADAS ==========
  
  // Verificar longitud para puntuación adicional
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 5;
  
  // Verificar diversidad de caracteres
  const charTypes = [
    /[a-z]/.test(password), // minúsculas
    /[A-Z]/.test(password), // mayúsculas
    /\d/.test(password), // números
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password), // especiales
    /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(password) // acentos/unicode
  ].filter(Boolean).length;
  
  score += charTypes * 5;
  
  // Verificar repetición de caracteres
  const charCounts = {};
  for (let char of password.toLowerCase()) {
    charCounts[char] = (charCounts[char] || 0) + 1;
  }
  
  const maxRepeats = Math.max(...Object.values(charCounts));
  if (maxRepeats > password.length * 0.3) {
    warnings.push('La contraseña tiene demasiados caracteres repetidos');
    score -= 15;
  }
  
  // ========== VALIDACIONES DE SEGURIDAD ==========
  
  // Verificar contraseñas comunes
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Esta contraseña es demasiado común y fácil de adivinar');
    score = 0;
  }
  
  // Verificar patrones débiles
  for (let pattern of WEAK_PATTERNS) {
    if (pattern.test(password.toLowerCase())) {
      errors.push('La contraseña contiene patrones predecibles (secuencias, repeticiones o patrones de teclado)');
      score -= 20;
      break;
    }
  }
  
  // Verificar información personal (si se proporciona)
  if (userInfo.nombre) {
    const nombre = userInfo.nombre.toLowerCase();
    if (password.toLowerCase().includes(nombre) || nombre.includes(password.toLowerCase())) {
      errors.push('La contraseña no debe contener tu nombre');
      score -= 15;
    }
  }
  
  if (userInfo.email) {
    const emailParts = userInfo.email.toLowerCase().split('@')[0];
    if (password.toLowerCase().includes(emailParts) || emailParts.includes(password.toLowerCase())) {
      errors.push('La contraseña no debe estar relacionada con tu email');
      score -= 15;
    }
  }
  
  // Verificar fechas comunes
  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 50; year <= currentYear + 5; year++) {
    if (password.includes(year.toString())) {
      warnings.push('Evita usar fechas en tu contraseña');
      score -= 5;
      break;
    }
  }
  
  // Verificar números telefónicos simples
  if (/(\d)\1{3,}/.test(password)) { // 4 o más números iguales seguidos
    warnings.push('Evita secuencias largas de números iguales');
    score -= 10;
  }
  
  // ========== VALIDACIONES DE ENTROPÍA ==========
  
  // Calcular entropía básica
  const uniqueChars = new Set(password).size;
  const entropy = uniqueChars * Math.log2(95); // ASCII printable chars
  
  if (entropy < 30) {
    warnings.push('La contraseña tiene baja entropía (diversidad de caracteres)');
    score -= 10;
  } else if (entropy > 60) {
    score += 15;
  }
  
  // ========== VERIFICACIONES ADICIONALES ==========
  
  // Verificar espacios (no al inicio/final)
  if (password.startsWith(' ') || password.endsWith(' ')) {
    warnings.push('Evita espacios al inicio o final de la contraseña');
  }
  
  // Verificar caracteres invisibles o problemáticos
  if (/[\x00-\x1F\x7F-\x9F]/.test(password)) {
    errors.push('La contraseña contiene caracteres no válidos');
  }
  
  // Verificar si es solo caracteres especiales
  if (/^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]+$/.test(password)) {
    warnings.push('Una contraseña solo de caracteres especiales puede ser difícil de recordar');
  }
  
  // ========== CÁLCULO DE FORTALEZA ==========
  
  // Normalizar score (0-100)
  score = Math.max(0, Math.min(100, score));
  
  let strength;
  if (errors.length > 0) {
    strength = 'invalid';
  } else if (score < 30) {
    strength = 'weak';
    errors.push('La contraseña es demasiado débil');
  } else if (score < 50) {
    strength = 'fair';
    warnings.push('Considera hacer tu contraseña más fuerte');
  } else if (score < 70) {
    strength = 'good';
  } else if (score < 85) {
    strength = 'strong';
  } else {
    strength = 'excellent';
  }
  
  return {
    isValid: errors.length === 0 && strength !== 'weak',
    errors,
    warnings,
    score,
    strength,
    entropy: entropy.toFixed(1),
    suggestions: generatePasswordSuggestions(password, errors)
  };
}

// ✅ GENERAR SUGERENCIAS PARA MEJORAR LA CONTRASEÑA
function generatePasswordSuggestions(password, errors) {
  const suggestions = [];
  
  if (errors.some(e => e.includes('mayúscula'))) {
    suggestions.push('Agrega al menos una letra mayúscula (A-Z)');
  }
  
  if (errors.some(e => e.includes('minúscula'))) {
    suggestions.push('Agrega al menos una letra minúscula (a-z)');
  }
  
  if (errors.some(e => e.includes('número'))) {
    suggestions.push('Incluye al menos un número (0-9)');
  }
  
  if (errors.some(e => e.includes('especial'))) {
    suggestions.push('Incluye símbolos como !@#$%^&*()');
  }
  
  if (errors.some(e => e.includes('8 caracteres'))) {
    suggestions.push('Usa al menos 8 caracteres (recomendado: 12+ caracteres)');
  }
  
  if (errors.some(e => e.includes('común'))) {
    suggestions.push('Evita contraseñas comunes - crea una única y personal');
  }
  
  if (errors.some(e => e.includes('patrones'))) {
    suggestions.push('Evita secuencias como 123, abc o patrones de teclado');
  }
  
  // Sugerencias generales
  suggestions.push('Considera usar una frase memorable con números y símbolos');
  suggestions.push('Ejemplo: "MiGato#Tiene9Vidas!" es fuerte y memorable');
  
  return suggestions;
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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
    // Validar formato del email destino
    const emailValidation = validateFormat(to, 'email', 'Email destino');
    if (!emailValidation.isValid) {
      console.error('❌ Email destino inválido:', emailValidation.error);
      return false;
    }

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

// ✅ FUNCIÓN ADMIN RESET PASSWORD CON VALIDACIONES ROBUSTAS
exports.adminResetPassword = async (req, res) => {
  try {
    // Validar formato del token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const tokenValidation = validateFormat(authHeader.split(' ')[1], 'jwtToken', 'Token de autenticación');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

    // Validar cuerpo de la solicitud
    const requestValidations = {
      userId: { type: 'numericId', required: false },
      email: { type: 'email', required: false }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { userId, email } = validation.validatedData;

    // Verificar que se proporcione al menos uno de los dos
    if (!userId && !email) {
      return res.status(200).json({
        success: false,
        message: 'Se requiere userId o email del usuario'
      });
    }

    const adminId = req.user.userId;

    // Verificar que el usuario que hace la solicitud es admin
    const adminUser = await Usuario.obtenerPorId(adminId);
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario administrador no encontrado'
      });
    }

    if (adminUser.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden restablecer contraseñas'
      });
    }

    // Buscar el usuario objetivo por ID o email
    let targetUser;
    if (userId) {
      targetUser = await Usuario.obtenerPorId(userId);
    } else if (email) {
      targetUser = await Usuario.obtenerPorEmail(email);
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
      // Intentar enviar email con información sobre validaciones
      emailSent = await sendEmail(
        targetUser.email,
        'Restablecimiento de contraseña solicitado por administrador',
        `<p>Un administrador ha solicitado el restablecimiento de tu contraseña.</p>
         <p>Haz clic <a href="${resetLink}">aquí</a> para crear una nueva contraseña.</p>
         <p><strong>Requisitos para tu nueva contraseña:</strong></p>
         <ul>
           <li>Mínimo 8 caracteres (recomendado: 12+)</li>
           <li>Al menos una letra mayúscula (A-Z)</li>
           <li>Al menos una letra minúscula (a-z)</li>
           <li>Al menos un número (0-9)</li>
           <li>Al menos un carácter especial (!@#$%^&*)</li>
           <li>No usar contraseñas comunes o información personal</li>
         </ul>
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
        mode: hasInternet ? 'online' : 'offline',
        passwordRequirements: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          avoidCommon: true,
          avoidPersonalInfo: true
        }
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

// ✅ FUNCIÓN FORGOT PASSWORD CON VALIDACIONES ROBUSTAS
exports.forgotPassword = async (req, res) => {
  try {
    // Validar cuerpo de la solicitud
    const requestValidations = {
      email: { type: 'email', required: true }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(200).json({ 
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { email } = validation.validatedData;
    
    // Validar dominios específicos
    const allowedDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
    const emailDomain = email.split('@')[1];
    
    if (!allowedDomains.includes(emailDomain)) {
      return res.status(200).json({ 
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
      // Intentar enviar email con requisitos de contraseña
      emailSent = await sendEmail(
        usuario.email,
        'Recuperación de contraseña',
        `<p>Has solicitado el restablecimiento de tu contraseña.</p>
         <p>Haz clic <a href="${resetLink}">aquí</a> para crear una nueva contraseña.</p>
         <p><strong>Tu nueva contraseña debe cumplir estos requisitos:</strong></p>
         <ul>
           <li>✅ Mínimo 8 caracteres (recomendado: 12 o más)</li>
           <li>✅ Al menos una letra mayúscula (A-Z)</li>
           <li>✅ Al menos una letra minúscula (a-z)</li>
           <li>✅ Al menos un número (0-9)</li>
           <li>✅ Al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)</li>
           <li>❌ No usar contraseñas comunes (123456, password, etc.)</li>
           <li>❌ No incluir tu nombre o email</li>
           <li>❌ Evitar secuencias (123, abc) o patrones repetitivos</li>
         </ul>
         <p><strong>Ejemplos de contraseñas fuertes:</strong></p>
         <ul>
           <li>MiPerro#Come7Tacos!</li>
           <li>Viaje2024$Madrid*Sol</li>
           <li>Café&Libros9am@Casa</li>
         </ul>
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
        mode: hasInternet ? 'online' : 'offline',
        passwordRequirements: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          avoidCommon: true,
          avoidPersonalInfo: true,
          examples: [
            'MiPerro#Come7Tacos!',
            'Viaje2024$Madrid*Sol',
            'Café&Libros9am@Casa'
          ]
        }
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

// ✅ RESET PASSWORD CON VALIDACIONES ULTRA ROBUSTAS
exports.resetPassword = async (req, res) => {
  try {
    // Validar cuerpo de la solicitud
    const requestValidations = {
      token: { type: 'jwtToken', required: true },
      password: { type: 'password', required: true, min: 8, max: 128 }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { token, password } = validation.validatedData;

    // Verificar el token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(200).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Verificar que es un token de restablecimiento
    if (decoded.type !== 'password_reset') {
      return res.status(200).json({
        success: false,
        message: 'Token no válido para restablecimiento'
      });
    }

    // Obtener usuario para validaciones
    const usuario = await Usuario.obtenerPorId(decoded.userId);
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // ✅ VALIDAR FORTALEZA DE LA NUEVA CONTRASEÑA
    const passwordValidation = validatePasswordStrength(password, {
      nombre: usuario.nombre,
      email: usuario.email
    });

    if (!passwordValidation.isValid) {
      return res.status(200).json({
        success: false,
        message: 'La nueva contraseña no cumple los requisitos de seguridad',
        data: {
          errors: passwordValidation.errors,
          warnings: passwordValidation.warnings,
          suggestions: passwordValidation.suggestions,
          strength: passwordValidation.strength,
          score: passwordValidation.score
        }
      });
    }

    // Verificar que no sea la misma contraseña actual
    const isSamePassword = await usuario.verificarPassword(password);
    if (isSamePassword) {
      return res.status(200).json({
        success: false,
        message: 'La nueva contraseña debe ser diferente a la actual',
        data: {
          suggestions: [
            'Crea una contraseña completamente nueva',
            'No reutilices tu contraseña anterior por seguridad'
          ]
        }
      });
    }

    // Cambiar la contraseña
    await usuario.cambiarPassword(password);

    console.log('✅ CONTRASEÑA RESTABLECIDA EXITOSAMENTE');
    console.log(`👤 Usuario: ${usuario.nombre} (${usuario.email})`);
    console.log(`🔒 Fortaleza: ${passwordValidation.strength.toUpperCase()}`);
    console.log(`📊 Score: ${passwordValidation.score}/100`);
    console.log(`🕒 Fecha: ${new Date().toLocaleString()}`);

    // Notificar cambio de contraseña exitoso
    await notificationMiddleware.onSuspiciousActivity(usuario.id, {
      tipo: 'password_actualizado',
      timestamp: new Date().toISOString(),
      ip: req.ip,
      fortaleza: passwordValidation.strength,
      score: passwordValidation.score
    });
    
    res.json({ 
      success: true,
      message: 'Contraseña actualizada correctamente',
      data: {
        passwordStrength: passwordValidation.strength,
        score: passwordValidation.score,
        warnings: passwordValidation.warnings
      }
    });

  } catch (err) {
    console.error('❌ Error actualizando contraseña:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Error actualizando contraseña' 
    });
  }
};

// ✅ CAMBIO DE CONTRASEÑA CON VALIDACIONES (para usuarios autenticados)
exports.changePassword = async (req, res) => {
  try {
    // Validar token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const tokenValidation = validateFormat(authHeader.split(' ')[1], 'jwtToken', 'Token de autenticación');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

    // Validar cuerpo de la solicitud
    const requestValidations = {
      currentPassword: { type: 'password', required: true, min: 1 },
      newPassword: { type: 'password', required: true, min: 8, max: 128 }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { currentPassword, newPassword } = validation.validatedData;
    const userId = req.user.userId;

    const usuario = await Usuario.obtenerPorId(userId);
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const isCurrentValid = await usuario.verificarPassword(currentPassword);
    if (!isCurrentValid) {
      await notificationMiddleware.onSuspiciousActivity(userId, {
        tipo: 'intento_cambio_password_fallido',
        timestamp: new Date().toISOString(),
        ip: req.ip,
        motivo: 'contraseña_actual_incorrecta'
      });

      return res.status(200).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Verificar que no sea la misma contraseña
    if (currentPassword === newPassword) {
      return res.status(200).json({
        success: false,
        message: 'La nueva contraseña debe ser diferente a la actual'
      });
    }

    // ✅ VALIDAR FORTALEZA DE LA NUEVA CONTRASEÑA
    const passwordValidation = validatePasswordStrength(newPassword, {
      nombre: usuario.nombre,
      email: usuario.email
    });

    if (!passwordValidation.isValid) {
      return res.status(200).json({
        success: false,
        message: 'La nueva contraseña no cumple los requisitos de seguridad',
        data: {
          errors: passwordValidation.errors,
          warnings: passwordValidation.warnings,
          suggestions: passwordValidation.suggestions,
          strength: passwordValidation.strength,
          score: passwordValidation.score,
          entropy: passwordValidation.entropy
        }
      });
    }

    // Cambiar contraseña
    await usuario.cambiarPassword(newPassword);

    console.log('✅ CONTRASEÑA CAMBIADA EXITOSAMENTE');
    console.log(`👤 Usuario: ${usuario.nombre} (${usuario.email})`);
    console.log(`🔒 Fortaleza: ${passwordValidation.strength.toUpperCase()}`);
    console.log(`📊 Score: ${passwordValidation.score}/100`);
    console.log(`🧬 Entropía: ${passwordValidation.entropy} bits`);

    // Notificar cambio exitoso
    await notificationMiddleware.onSuspiciousActivity(userId, {
      tipo: 'password_cambiado_exitosamente',
      timestamp: new Date().toISOString(),
      ip: req.ip,
      fortaleza: passwordValidation.strength,
      score: passwordValidation.score
    });

    res.json({
      success: true,
      message: 'Contraseña cambiada exitosamente',
      data: {
        passwordStrength: passwordValidation.strength,
        score: passwordValidation.score,
        entropy: passwordValidation.entropy,
        warnings: passwordValidation.warnings,
        changeTime: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ Error cambiando contraseña:', err);
    res.status(500).json({
      success: false,
      message: 'Error cambiando contraseña'
    });
  }
};

// Obtener usuario autenticado
exports.me = async (req, res) => {
  try {
    // Validar token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Token de autenticación requerido' 
      });
    }

    const tokenValidation = validateFormat(authHeader.split(' ')[1], 'jwtToken', 'Token de autenticación');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

    const usuario = await Usuario.obtenerPorId(req.user.userId);
    if (!usuario) return res.status(404).json({ 
      success: false,
      message: 'Usuario no encontrado' 
    });
    
    // Actualizar actividad de la sesión
    updateSessionActivity(req.user.userId);
    
    res.json({
      success: true,
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });
  } catch (err) {
    console.error('❌ Error obteniendo usuario autenticado:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener usuario autenticado' 
    });
  }
};

// ✅ REGISTRO DE USUARIO CON VALIDACIONES ULTRA ROBUSTAS
exports.register = async (req, res) => {
  try {
    // Validar cuerpo de la solicitud
    const requestValidations = {
      nombre: { type: 'nombre', required: true, min: 2, max: 50 },
      email: { type: 'email', required: true },
      password: { type: 'password', required: true, min: 8, max: 128 },
      rol: { type: 'rol', required: false },
      latitude: { type: 'latitude', required: false },
      longitude: { type: 'longitude', required: false },
      accuracy: { type: 'accuracy', required: false, min: 0 },
      locationTimestamp: { type: 'isoTimestamp', required: false }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { 
      nombre, 
      email, 
      password, 
      rol,
      latitude,
      longitude,
      accuracy,
      locationTimestamp
    } = validation.validatedData;

    // Validar dominios específicos
    const allowedDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
    const emailDomain = email.split('@')[1];
    
    if (!allowedDomains.includes(emailDomain)) {
      return res.status(200).json({ 
        success: false,
        message: 'Dominio de email no permitido. Use @gmail.com, @hotmail.com, etc.' 
      });
    }

    // ✅ VALIDAR FORTALEZA DE CONTRASEÑA ANTES DE CREAR USUARIO
    const passwordValidation = validatePasswordStrength(password, {
      nombre: nombre,
      email: email
    });

    if (!passwordValidation.isValid) {
      return res.status(200).json({
        success: false,
        message: 'La contraseña no cumple los requisitos de seguridad',
        data: {
          errors: passwordValidation.errors,
          warnings: passwordValidation.warnings,
          suggestions: passwordValidation.suggestions,
          strength: passwordValidation.strength,
          score: passwordValidation.score,
          entropy: passwordValidation.entropy,
          requirements: {
            minLength: '8+ caracteres (recomendado: 12+)',
            uppercase: 'Al menos una mayúscula (A-Z)',
            lowercase: 'Al menos una minúscula (a-z)',
            numbers: 'Al menos un número (0-9)',
            specials: 'Al menos un símbolo (!@#$%^&*)',
            avoid: 'No usar contraseñas comunes o información personal'
          }
        }
      });
    }

    // Mostrar advertencias si las hay (pero no bloquear)
    if (passwordValidation.warnings.length > 0) {
      console.log(`⚠️  Advertencias de contraseña para ${email}:`, passwordValidation.warnings);
    }

    // Validar consistencia de coordenadas
    if ((latitude !== undefined || longitude !== undefined)) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(200).json({
          success: false,
          message: 'Si proporcionas ubicación, tanto latitude como longitude son requeridos'
        });
      }
    }
    
    // Crear y validar usuario
    const usuario = new Usuario(null, nombre, email, password, rol || 'lector');

    const errores = usuario.validar();
    if (errores.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: errores.join(', ') 
      });
    }

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.obtenerPorEmail(email);
    if (usuarioExistente) {
      return res.status(409).json({ 
        success: false,
        message: 'El email ya está registrado.' 
      });
    }

    // Guardar usuario
    await usuario.guardar();

    // Si se proporcionaron datos de ubicación, guardarlos
    let ubicacionGuardada = false;
    if (latitude !== undefined && longitude !== undefined) {
      try {
        await Usuario.actualizarUbicacion(usuario.id, {
          latitude,
          longitude,
          accuracy: accuracy || 0,
          timestamp: locationTimestamp ? new Date(locationTimestamp) : new Date()
        });

        ubicacionGuardada = true;
        console.log(`📍 Ubicación inicial guardada para usuario: ${usuario.nombre} (${latitude}, ${longitude})`);
      } catch (locationError) {
        console.error('❌ Error al guardar ubicación inicial:', locationError);
        // No fallar el registro por error de ubicación, solo loggearlo
      }
    }

    console.log('✅ USUARIO REGISTRADO EXITOSAMENTE');
    console.log(`👤 Usuario: ${usuario.nombre} (${usuario.email})`);
    console.log(`🔒 Fortaleza contraseña: ${passwordValidation.strength.toUpperCase()}`);
    console.log(`📊 Score: ${passwordValidation.score}/100`);
    console.log(`🧬 Entropía: ${passwordValidation.entropy} bits`);
    console.log(`📍 Ubicación: ${ubicacionGuardada ? 'SÍ' : 'NO'}`);

    // Notificación de bienvenida
    await notificationMiddleware.onSystemUpdate({
      message: `Bienvenido ${usuario.nombre}! Tu cuenta ha sido creada exitosamente.`,
      tipo: 'bienvenida',
      ubicacion_incluida: ubicacionGuardada,
      password_strength: passwordValidation.strength
    });

    res.status(201).json({ 
      success: true,
      message: 'Usuario registrado correctamente' + (ubicacionGuardada ? ' con ubicación inicial' : ''),
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        fecha_creacion: usuario.fecha_creacion,
        ubicacion_guardada: ubicacionGuardada,
        passwordSecurity: {
          strength: passwordValidation.strength,
          score: passwordValidation.score,
          entropy: passwordValidation.entropy,
          warnings: passwordValidation.warnings
        }
      }
    });
  } catch (err) {
    console.error('❌ Error en el registro:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error en el registro.' 
    });
  }
};

// ✅ LOGIN CON CONTROL DE SESIONES ACTIVAS
exports.login = async (req, res) => {
  try {
    // Validar cuerpo de la solicitud
    const requestValidations = {
      email: { type: 'email', required: true },
      password: { type: 'password', required: true, min: 1 }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { email, password } = validation.validatedData;

    const usuario = await Usuario.obtenerPorEmail(email);
    if (!usuario) {
      return res.status(200).json({ 
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
      
      return res.status(200).json({ 
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
        `<p>Tu código de acceso es: <b>${otp}</b>. Expira en ${OTP_EXPIRATION_MINUTES} minutos.</p>
         <p><strong>Consejos de seguridad:</strong></p>
         <ul>
           <li>No compartas este código con nadie</li>
           <li>Solo ingrésalo en la aplicación oficial</li>
           <li>Si no solicitaste este acceso, cambia tu contraseña</li>
         </ul>`
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
    // Validar cuerpo de la solicitud
    const requestValidations = {
      userId: { type: 'numericId', required: true },
      otp: { type: 'otp', required: true }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { userId, otp } = validation.validatedData;
    const startTime = Date.now();

    const query = require('../config/database').query;
    
    const result = await query(
      `SELECT id, nombre, email, rol, otp, otp_expires, offline_code_hash, offline_code_expires 
       FROM usuarios WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(200).json({ 
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
      
      return res.status(200).json({ 
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

// ✅ ENDPOINT PARA VALIDAR CONTRASEÑA SIN CAMBIARLA
exports.validatePassword = async (req, res) => {
  try {
    // Validar cuerpo de la solicitud
    const requestValidations = {
      password: { type: 'password', required: true, min: 8, max: 128 },
      userData: { type: 'object', required: false }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { password, userData } = validation.validatedData;

    // Obtener información del usuario si está autenticado
    let userInfo = {};
    if (req.user && req.user.userId) {
      const usuario = await Usuario.obtenerPorId(req.user.userId);
      if (usuario) {
        userInfo = {
          nombre: usuario.nombre,
          email: usuario.email
        };
      }
    }

    // Si se proporciona userData en el body, usarla
    if (userData) {
      userInfo = { ...userInfo, ...userData };
    }

    const validationResult = validatePasswordStrength(password, userInfo);

    res.json({
      success: true,
      data: {
        isValid: validationResult.isValid,
        strength: validationResult.strength,
        score: validationResult.score,
        entropy: validationResult.entropy,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        suggestions: validationResult.suggestions
      }
    });

  } catch (err) {
    console.error('❌ Error validando contraseña:', err);
    res.status(500).json({
      success: false,
      message: 'Error validando contraseña'
    });
  }
};

// ✅ LOGOUT - ELIMINAR SESIÓN ACTIVA
exports.logout = async (req, res) => {
  try {
    // Validar token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const tokenValidation = validateFormat(authHeader.split(' ')[1], 'jwtToken', 'Token de autenticación');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

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
    // Validar token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const tokenValidation = validateFormat(authHeader.split(' ')[1], 'jwtToken', 'Token de autenticación');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

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
    // Validar token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const tokenValidation = validateFormat(authHeader.split(' ')[1], 'jwtToken', 'Token de autenticación');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

    // Validar cuerpo de la solicitud
    const requestValidations = {
      userId: { type: 'numericId', required: true }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { userId } = validation.validatedData;
    
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

    // Validar formato del token
    const tokenValidation = validateFormat(token, 'jwtToken', 'Token');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
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
    // Validar token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const tokenValidation = validateFormat(authHeader.split(' ')[1], 'jwtToken', 'Token de autenticación');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

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

// ✅ GENERAR CONTRASEÑA SEGURA (Endpoint auxiliar)
exports.generateSecurePassword = async (req, res) => {
  try {
    // Validar cuerpo de la solicitud
    const requestValidations = {
      length: { type: 'numericId', required: false, min: 8, max: 128 },
      includeSymbols: { type: 'boolean', required: false },
      avoidAmbiguous: { type: 'boolean', required: false }
    };

    const validation = validateRequestBody(req.body, requestValidations);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: validation.errors
      });
    }

    const { length = 16, includeSymbols = true, avoidAmbiguous = true } = validation.validatedData;
    
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = includeSymbols ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '';
    
    // Caracteres ambiguos a evitar
    const ambiguous = avoidAmbiguous ? '0O1lI|`' : '';
    
    let charset = lowercase + uppercase + numbers + symbols;
    
    // Remover caracteres ambiguos si se solicita
    if (avoidAmbiguous) {
      charset = charset.split('').filter(char => !ambiguous.includes(char)).join('');
    }
    
    let password = '';
    
    // Garantizar al menos un carácter de cada tipo
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    if (includeSymbols) {
      const cleanSymbols = symbols.split('').filter(char => !ambiguous.includes(char)).join('');
      password += cleanSymbols[Math.floor(Math.random() * cleanSymbols.length)];
    }
    
    // Completar con caracteres aleatorios
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Mezclar la contraseña
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    // Validar la contraseña generada
    const validationResult = validatePasswordStrength(password);
    
    res.json({
      success: true,
      data: {
        password: password,
        strength: validationResult.strength,
        score: validationResult.score,
        entropy: validationResult.entropy,
        length: password.length,
        composition: {
          hasLowercase: /[a-z]/.test(password),
          hasUppercase: /[A-Z]/.test(password),
          hasNumbers: /\d/.test(password),
          hasSymbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)
        }
      }
    });
    
  } catch (err) {
    console.error('❌ Error generando contraseña segura:', err);
    res.status(500).json({
      success: false,
      message: 'Error generando contraseña segura'
    });
  }
};

// ✅ ENDPOINT PARA OBTENER MÉTRICAS DE SEGURIDAD DE CONTRASEÑAS (admin)
exports.getPasswordSecurityMetrics = async (req, res) => {
  try {
    // Validar token de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const tokenValidation = validateFormat(authHeader.split(' ')[1], 'jwtToken', 'Token de autenticación');
    if (!tokenValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

    // Verificar que el usuario es admin
    const adminUser = await Usuario.obtenerPorId(req.user.userId);
    if (adminUser.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden ver métricas de seguridad'
      });
    }
    
    const query = require('../config/database').query;
    
    const userCountResult = await query('SELECT COUNT(*) as total FROM usuarios');
    const totalUsers = parseInt(userCountResult.rows[0].total);
    
    // Métricas simuladas (en un sistema real, almacenarías estas métricas)
    const metrics = {
      totalUsers: totalUsers,
      passwordPolicyCompliance: {
        enforced: true,
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        blockCommonPasswords: true
      },
      strengthDistribution: {
        excellent: Math.floor(totalUsers * 0.25),
        strong: Math.floor(totalUsers * 0.30),
        good: Math.floor(totalUsers * 0.25),
        fair: Math.floor(totalUsers * 0.15),
        weak: Math.floor(totalUsers * 0.05)
      },
      securityEvents: {
        lastPasswordResets: activeSessions.size,
        suspiciousActivities: 0,
        blockedWeakPasswords: 0
      },
      recommendations: [
        'Continuar enforcing strong password policy',
        'Consider implementing password expiration reminders',
        'Monitor for password reuse across accounts',
        'Educate users on password best practices'
      ]
    };
    
    res.json({
      success: true,
      data: metrics,
      generatedAt: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ Error obteniendo métricas de seguridad:', err);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo métricas de seguridad'
    });
  }
};

// ✅ FUNCIÓN AUXILIAR PARA LIMPIAR SESIONES EXPIRADAS
function cleanExpiredSessions() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [userId, session] of activeSessions.entries()) {
    if (now >= session.expiresAt) {
      activeSessions.delete(userId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Limpiadas ${cleanedCount} sesiones expiradas`);
  }
  
  return cleanedCount;
}

// ✅ PROGRAMAR LIMPIEZA AUTOMÁTICA DE SESIONES (ejecutar cada 5 minutos)
setInterval(cleanExpiredSessions, 5 * 60 * 1000);

// ✅ ENDPOINT PARA OBTENER INFORMACIÓN DETALLADA SOBRE REQUISITOS DE CONTRASEÑA
exports.getPasswordRequirements = async (req, res) => {
  try {
    const requirements = {
      policy: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?`~',
        blockCommonPasswords: true,
        blockPersonalInfo: true,
        blockSequentialPatterns: true
      },
      strengthLevels: {
        invalid: { minScore: 0, description: 'No cumple requisitos básicos' },
        weak: { minScore: 1, maxScore: 29, description: 'Muy vulnerable a ataques' },
        fair: { minScore: 30, maxScore: 49, description: 'Cumple mínimo pero mejorable' },
        good: { minScore: 50, maxScore: 69, description: 'Adecuada para uso general' },
        strong: { minScore: 70, maxScore: 84, description: 'Muy segura' },
        excellent: { minScore: 85, maxScore: 100, description: 'Extremadamente segura' }
      },
      examples: {
        weak: [
          '123456',
          'password',
          'qwerty123',
          'admin'
        ],
        strong: [
          'MiGato#Come7Tacos!',
          'Viaje2024$Madrid*Sol',
          'Café&Libros9am@Casa',
          'Luna#Brillante88*Noche'
        ]
      },
      tips: [
        'Usa frases memorables con números y símbolos',
        'Combina palabras no relacionadas',
        'Incluye mayúsculas, minúsculas, números y símbolos',
        'Evita información personal (nombres, fechas, etc.)',
        'No uses la misma contraseña en múltiples sitios',
        'Considera usar un gestor de contraseñas',
        'Cambia contraseñas comprometidas inmediatamente'
      ],
      commonMistakes: [
        'Usar solo números o solo letras',
        'Repetir caracteres (aaaa, 1111)',
        'Secuencias predecibles (123, abc)',
        'Información personal visible',
        'Contraseñas demasiado cortas',
        'Patrones de teclado (qwerty, asdf)',
        'Años recientes como parte de la contraseña'
      ]
    };
    
    res.json({
      success: true,
      data: requirements,
      version: '1.0',
      lastUpdated: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ Error obteniendo requisitos de contraseña:', err);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo requisitos de contraseña'
    });
  }
};

// ✅ MIDDLEWARE PARA VALIDAR CONTRASEÑA EN ENDPOINTS QUE LA REQUIERAN
exports.passwordValidationMiddleware = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return next(); // Si no hay contraseña, continuar (validación se hará en el endpoint)
  }
  
  // Validar formato básico primero
  const formatValidation = validateFormat(password, 'password', 'Contraseña');
  if (!formatValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: formatValidation.error
    });
  }
  
  const validation = validatePasswordStrength(password, {
    nombre: req.body.nombre,
    email: req.body.email
  });
  
  if (!validation.isValid) {
    return res.status(200).json({
      success: false,
      message: 'La contraseña no cumple los requisitos de seguridad',
      data: {
        errors: validation.errors,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
        strength: validation.strength,
        score: validation.score
      }
    });
  }
  
  // Agregar información de validación al request para uso posterior
  req.passwordValidation = validation;
  next();
};

module.exports = exports;