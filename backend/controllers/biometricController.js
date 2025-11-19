const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// Configurar transporter de email
const SibApiV3Sdk = require('@sendinblue/client');

// Configurar Brevo
const brevoApi = new SibApiV3Sdk.TransactionalEmailsApi();
brevoApi.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);
class BiometricController {
    
    // Crear/actualizar PIN
    static async setupPIN(req, res) {
        try {
            const { userId } = req.user;
            const { pin } = req.body;

            if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
                return res.status(400).json({
                    success: false,
                    message: 'El PIN debe tener exactamente 4 dígitos numéricos'
                });
            }

            // Verificar si el usuario existe
            const userResult = await query(
                'SELECT id, pin_hash FROM usuarios WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // Hashear el PIN
            const saltRounds = 10;
            const pinHash = await bcrypt.hash(pin, saltRounds);

            // Actualizar usuario con PIN
            await query(
                `UPDATE usuarios 
                 SET pin_hash = $1, pin_created_at = NOW(), 
                     biometric_enabled = true, failed_pin_attempts = 0,
                     pin_locked_until = NULL
                 WHERE id = $2`,
                [pinHash, userId]
            );

            res.json({
                success: true,
                message: 'PIN configurado correctamente',
                biometricEnabled: true
            });

        } catch (error) {
            console.error('Error configurando PIN:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Verificar PIN
    static async verifyPIN(req, res) {
        try {
            const { userId } = req.user;
            const { pin } = req.body;

            console.log('🔍 Verificando PIN para usuario:', userId);
            console.log('📝 PIN recibido:', pin);

            if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
                return res.status(400).json({
                    success: false,
                    message: 'PIN inválido'
                });
            }

            // Verificar intentos y bloqueos
            const canAttempt = await query(
                'SELECT verificar_intentos_pin($1) as puede_intentar',
                [userId]
            );

            if (!canAttempt.rows[0].puede_intentar) {
                const lockInfo = await query(
                    'SELECT pin_locked_until FROM usuarios WHERE id = $1',
                    [userId]
                );
                
                return res.status(423).json({
                    success: false,
                    message: 'Demasiados intentos fallidos. Intenta más tarde.',
                    lockedUntil: lockInfo.rows[0].pin_locked_until
                });
            }

            // Obtener hash del PIN con más información de debug
            const userResult = await query(
                'SELECT id, pin_hash, failed_pin_attempts FROM usuarios WHERE id = $1',
                [userId]
            );

            console.log('👤 Usuario encontrado:', userResult.rows[0] ? 'Sí' : 'No');
            console.log('🔐 Hash almacenado:', userResult.rows[0]?.pin_hash ? 'Sí' : 'No');

            if (userResult.rows.length === 0 || !userResult.rows[0].pin_hash) {
                return res.status(404).json({
                    success: false,
                    message: 'PIN no configurado'
                });
            }

            const pinHash = userResult.rows[0].pin_hash;
            console.log('🔑 Comparando PIN...');

            // Debug detallado de bcrypt
            const isValid = await bcrypt.compare(pin, pinHash);
            console.log('✅ Resultado de bcrypt.compare:', isValid);

            if (isValid) {
                // Resetear intentos fallidos
                await query(
                    'UPDATE usuarios SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = $1',
                    [userId]
                );

                console.log('🎉 PIN verificado correctamente para usuario:', userId);

                // Generar token de sesión biométrica
                const biometricToken = jwt.sign(
                    { 
                        userId: userId, 
                        biometric: true,
                        type: 'biometric_session'
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '8h' }
                );

                res.json({
                    success: true,
                    message: 'PIN verificado correctamente',
                    biometricToken: biometricToken,
                    biometricEnabled: true
                });
            } else {
                // Incrementar intentos fallidos
                await query(
                    'UPDATE usuarios SET failed_pin_attempts = failed_pin_attempts + 1 WHERE id = $1',
                    [userId]
                );

                const attemptsResult = await query(
                    'SELECT failed_pin_attempts FROM usuarios WHERE id = $1',
                    [userId]
                );

                const attemptsLeft = 5 - attemptsResult.rows[0].failed_pin_attempts;

                console.log('❌ PIN incorrecto. Intentos fallidos:', attemptsResult.rows[0].failed_pin_attempts);

                res.status(401).json({
                    success: false,
                    message: `PIN incorrecto. Te quedan ${attemptsLeft} intentos.`,
                    attemptsLeft: attemptsLeft
                });
            }

        } catch (error) {
            console.error('💥 Error verificando PIN:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Obtener estado del PIN
    static async getPINStatus(req, res) {
        try {
            const { userId } = req.user;

            const userResult = await query(
                `SELECT biometric_enabled, pin_created_at, failed_pin_attempts, 
                        pin_locked_until, fecha_creacion < NOW() - INTERVAL '1 hour' as is_new_user
                 FROM usuarios WHERE id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            const user = userResult.rows[0];
            
            res.json({
                success: true,
                biometricEnabled: user.biometric_enabled,
                pinCreatedAt: user.pin_created_at,
                failedAttempts: user.failed_pin_attempts,
                isLocked: user.pin_locked_until && user.pin_locked_until > new Date(),
                lockedUntil: user.pin_locked_until,
                requiresSetup: !user.biometric_enabled && user.is_new_user
            });

        } catch (error) {
            console.error('Error obteniendo estado del PIN:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Deshabilitar PIN biométrico
    static async disableBiometric(req, res) {
        try {
            const { userId } = req.user;

            await query(
                `UPDATE usuarios 
                 SET pin_hash = NULL, biometric_enabled = false, 
                     pin_created_at = NULL, failed_pin_attempts = 0,
                     pin_locked_until = NULL
                 WHERE id = $1`,
                [userId]
            );

            res.json({
                success: true,
                message: 'Autenticación biométrica deshabilitada',
                biometricEnabled: false
            });

        } catch (error) {
            console.error('Error deshabilitando biométrico:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Cambiar PIN existente
    static async changePIN(req, res) {
        try {
            const { userId } = req.user;
            const { currentPin, newPin } = req.body;

            // Primero verificar el PIN actual
            const verifyResult = await this.verifyPINInternal(userId, currentPin);
            if (!verifyResult.valid) {
                return res.status(401).json({
                    success: false,
                    message: verifyResult.message
                });
            }

            // Validar nuevo PIN
            if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) {
                return res.status(400).json({
                    success: false,
                    message: 'El nuevo PIN debe tener exactamente 4 dígitos numéricos'
                });
            }

            // Hashear nuevo PIN
            const saltRounds = 10;
            const newPinHash = await bcrypt.hash(newPin, saltRounds);

            // Actualizar PIN
            await query(
                `UPDATE usuarios 
                 SET pin_hash = $1, pin_created_at = NOW(), 
                     failed_pin_attempts = 0, pin_locked_until = NULL
                 WHERE id = $2`,
                [newPinHash, userId]
            );

            res.json({
                success: true,
                message: 'PIN cambiado correctamente'
            });

        } catch (error) {
            console.error('Error cambiando PIN:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Función interna para verificar PIN
    static async verifyPINInternal(userId, pin) {
        try {
            const userResult = await query(
                'SELECT pin_hash FROM usuarios WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].pin_hash) {
                return { valid: false, message: 'PIN no configurado' };
            }

            const isValid = await bcrypt.compare(pin, userResult.rows[0].pin_hash);
            return { 
                valid: isValid, 
                message: isValid ? 'PIN válido' : 'PIN incorrecto' 
            };

        } catch (error) {
            console.error('Error en verificación interna de PIN:', error);
            return { valid: false, message: 'Error de verificación' };
        }
    }

    // Función para solicitar restablecimiento de PIN
    static async requestPINReset(req, res) {
        try {
            const { email } = req.body;

            console.log('📧 === REQUEST PIN RESET ===');
            console.log('Email solicitado:', email);

            if (!email) {
                console.log('❌ Email no proporcionado');
                return res.status(400).json({
                    success: false,
                    message: 'El email es requerido'
                });
            }

            // Verificar que el usuario existe y está bloqueado
            console.log('🔍 Buscando usuario en BD...');
            const userResult = await query(
                `SELECT id, nombre, email, pin_locked_until, failed_pin_attempts 
                 FROM usuarios WHERE email = $1`,
                [email]
            );

            console.log('👤 Usuarios encontrados:', userResult.rows.length);

            if (userResult.rows.length === 0) {
                console.log('❌ No se encontró usuario con email:', email);
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró una cuenta con este email'
                });
            }

            const user = userResult.rows[0];
            console.log('✅ Usuario encontrado:');
            console.log('   ID:', user.id);
            console.log('   Nombre:', user.nombre);
            console.log('   Email:', user.email);
            console.log('   Bloqueado hasta:', user.pin_locked_until);
            console.log('   Intentos fallidos:', user.failed_pin_attempts);

            // Verificar que realmente esté bloqueado
            const ahora = new Date();
            const estaBloqueado = user.pin_locked_until && user.pin_locked_until > ahora;
            
            console.log('🔒 Verificando estado de bloqueo:');
            console.log('   Hora actual:', ahora);
            console.log('   Bloqueado hasta:', user.pin_locked_until);
            console.log('   Está bloqueado?:', estaBloqueado);

            if (!estaBloqueado) {
                console.log('❌ Usuario no está bloqueado');
                return res.status(400).json({
                    success: false,
                    message: 'Tu cuenta no está bloqueada'
                });
            }

            // Generar código de verificación
      const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        const resetId = `reset_${crypto.randomBytes(16).toString('hex')}`; // ✅ NUEVO
        const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);

            
        console.log('🔐 Código generado:', resetCode);
        console.log('🆔 Reset ID generado:', resetId);
        console.log('⏰ Expira:', resetExpiry);

            // Guardar código en la base de datos
            console.log('💾 Guardando código en BD...');
            await query(
            `UPDATE usuarios 
             SET reset_code = $1, reset_code_expires = $2, reset_code_attempts = 0,
                 reset_id = $3
             WHERE id = $4`,
            [resetCode, resetExpiry, resetId, user.id]  // ✅ Agregar resetId
        );

            // Enviar email
            console.log('📤 Enviando email a:', email);
            const mailOptions = {
                from: process.env.FROM_EMAIL,
                to: email,
                subject: 'Restablecimiento de PIN - Código de Verificación',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Restablecimiento de PIN</h2>
                        <p>Hola ${user.nombre},</p>
                        <p>Hemos recibido una solicitud para restablecer tu PIN de seguridad.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <h3 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 4px;">${resetCode}</h3>
                            <p style="margin: 10px 0 0 0; color: #666;">Código de verificación</p>
                        </div>
                        
                        <p><strong>Este código expira en 15 minutos.</strong></p>
                        <p>Si no solicitaste este restablecimiento, puedes ignorar este email de forma segura.</p>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #666; font-size: 12px;">
                            Este es un email automático, por favor no respondas a este mensaje.
                        </p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log('✅ Email enviado exitosamente');

            res.json({
            success: true,
            message: 'Código de verificación enviado a tu email',
            email: email.replace(/(.{3}).*(@.*)/, '$1***$2'),
            resetId: resetId  // ✅ AGREGAR ESTO
        });

            console.log('🎉 Solicitud de reset completada exitosamente');

        } catch (error) {
            console.error('💥 Error enviando código de restablecimiento:', error);
            res.status(500).json({
                success: false,
                message: 'Error enviando código de verificación'
            });
        }
    }

    // NUEVA FUNCIÓN: Solo verificar el código (sin PIN)
    static async verifyCodeOnly(req, res) {
         try {
        const { resetId, verificationCode } = req.body; // ✅ Cambiar aquí

        console.log('🔐 === VERIFY CODE ONLY ===');
        console.log('🆔 Reset ID recibido:', resetId);
        console.log('🔢 Código recibido:', verificationCode);

        if (!resetId || !verificationCode) {
            console.log('❌ Faltan datos requeridos');
            return res.status(400).json({
                success: false,
                message: 'Reset ID y código son requeridos'
            });
        }

            // Buscar usuario
             // Buscar usuario por resetId
        console.log('🔍 Buscando usuario por resetId...');
        const userResult = await query(
            `SELECT id, reset_code, reset_code_expires, reset_code_attempts 
             FROM usuarios 
             WHERE reset_id = $1 AND reset_code IS NOT NULL`,
            [resetId]
        );

        console.log('👤 Resultados de búsqueda:', userResult.rows.length);

        if (userResult.rows.length === 0) {
            console.log('❌ No se encontró solicitud de reset para resetId:', resetId);
            return res.status(404).json({
                success: false,
                message: 'Solicitud de restablecimiento no encontrada'
            });
        }
            const user = userResult.rows[0];
        console.log('📋 Datos del usuario:');
        console.log('   ID:', user.id);
        console.log('   Código en BD:', user.reset_code);
        console.log('   Expira:', user.reset_code_expires);
        console.log('   Intentos actuales:', user.reset_code_attempts);


            // Verificar intentos de código
            if (user.reset_code_attempts >= 3) {
                console.log('❌ Demasiados intentos:', user.reset_code_attempts);
                await query(
                    'UPDATE usuarios SET reset_code = NULL, reset_code_expires = NULL, reset_code_attempts = 0 WHERE id = $1',
                    [user.id]
                );
                return res.status(429).json({
                    success: false,
                    message: 'Demasiados intentos con código incorrecto. Solicita un nuevo código.'
                });
            }

            // Verificar que el código existe y no ha expirado
            if (!user.reset_code || !user.reset_code_expires) {
                console.log('❌ Código no existe o expirado');
                return res.status(400).json({
                    success: false,
                    message: 'Código de verificación expirado o inválido'
                });
            }

            if (user.reset_code_expires < new Date()) {
                console.log('❌ Código expirado');
                return res.status(400).json({
                    success: false,
                    message: 'Código de verificación expirado o inválido'
                });
            }

            // Verificar código
            console.log('🔍 Comparando códigos:');
            console.log('   Código BD:', user.reset_code);
            console.log('   Código recibido:', resetCode);
            console.log('   Coinciden:', user.reset_code === resetCode.toUpperCase());

            if (user.reset_code !== resetCode.toUpperCase()) {
                console.log('❌ Código incorrecto');
                await query(
                    'UPDATE usuarios SET reset_code_attempts = reset_code_attempts + 1 WHERE id = $1',
                    [user.id]
                );
                
                const attemptsLeft = 3 - (user.reset_code_attempts + 1);
                console.log('   Intentos restantes:', attemptsLeft);
                
                return res.status(400).json({
                    success: false,
                    message: `Código incorrecto. Te quedan ${attemptsLeft} intentos.`
                });
            }

            console.log('✅ Código correcto');
            res.json({
                success: true,
                message: 'Código verificado correctamente'
            });

         } catch (error) {
        console.error('💥 Error verificando código:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
}

    // Función para restablecer PIN con código verificado
    // Función para restablecer PIN con código verificado
static async resetPINWithCode(req, res) {
    try {
        const { resetId, verificationCode, newPin } = req.body; // ✅ Cambiar aquí

        console.log('🔐 === RESET PIN WITH CODE ===');
        console.log('🆔 Reset ID recibido:', resetId);
        console.log('🔢 Código recibido:', verificationCode);
        console.log('🔑 Nuevo PIN recibido:', newPin);

        // Validaciones
        if (!resetId || !verificationCode || !newPin) {
            console.log('❌ Faltan datos requeridos');
            return res.status(400).json({
                success: false,
                message: 'Reset ID, código y nuevo PIN son requeridos'
            });
        }

        if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
            console.log('❌ PIN inválido:', newPin);
            return res.status(400).json({
                success: false,
                message: 'El PIN debe tener exactamente 4 dígitos numéricos'
            });
        }

        // Verificar código común
        const pinsComunes = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234'];
        if (pinsComunes.includes(newPin)) {
            console.log('❌ PIN común detectado:', newPin);
            return res.status(400).json({
                success: false,
                message: 'Por seguridad, elige un PIN menos común'
            });
        }

        // Buscar usuario por resetId en lugar de email
        console.log('🔍 Buscando usuario por resetId en BD...');
        const userResult = await query(
            `SELECT id, reset_code, reset_code_expires, reset_code_attempts, email
             FROM usuarios 
             WHERE reset_id = $1 AND reset_code IS NOT NULL`,
            [resetId]
        );

        console.log('👤 Resultados de búsqueda por resetId:', userResult.rows.length);

        if (userResult.rows.length === 0) {
            console.log('❌ No se encontró solicitud de reset activa para resetId:', resetId);
            return res.status(404).json({
                success: false,
                message: 'Solicitud de restablecimiento no encontrada o expirada'
            });
        }

        const user = userResult.rows[0];
        console.log('📋 Datos del usuario encontrado:');
        console.log('   ID:', user.id);
        console.log('   Email:', user.email);
        console.log('   Código en BD:', user.reset_code);
        console.log('   Expira:', user.reset_code_expires);
        console.log('   Intentos:', user.reset_code_attempts);

        // Verificar que el código no haya expirado
        if (user.reset_code_expires < new Date()) {
            console.log('❌ Código expirado');
            // Limpiar código expirado
            await query(
                'UPDATE usuarios SET reset_code = NULL, reset_code_expires = NULL, reset_code_attempts = 0 WHERE id = $1',
                [user.id]
            );
            return res.status(400).json({
                success: false,
                message: 'El código de verificación ha expirado. Solicita uno nuevo.'
            });
        }

        // Verificar intentos de código
        if (user.reset_code_attempts >= 3) {
            console.log('❌ Demasiados intentos fallidos:', user.reset_code_attempts);
            await query(
                'UPDATE usuarios SET reset_code = NULL, reset_code_expires = NULL, reset_code_attempts = 0 WHERE id = $1',
                [user.id]
            );
            return res.status(429).json({
                success: false,
                message: 'Demasiados intentos fallidos. Solicita un nuevo código.'
            });
        }

        // Verificar código (convertir a mayúsculas para comparar)
        console.log('🔍 Comparando códigos:');
        console.log('   Código BD:', user.reset_code);
        console.log('   Código recibido:', verificationCode);
        console.log('   Coinciden:', user.reset_code === verificationCode.toUpperCase());

        if (user.reset_code !== verificationCode.toUpperCase()) {
            console.log('❌ Código incorrecto');
            // Incrementar intentos fallidos
            await query(
                'UPDATE usuarios SET reset_code_attempts = reset_code_attempts + 1 WHERE id = $1',
                [user.id]
            );
            
            const attemptsLeft = 3 - (user.reset_code_attempts + 1);
            console.log('   Intentos restantes:', attemptsLeft);
            
            return res.status(400).json({
                success: false,
                message: `Código incorrecto. Te quedan ${attemptsLeft} intentos.`
            });
        }

        console.log('✅ Código correcto - Restableciendo PIN...');

        // Hashear nuevo PIN
        const saltRounds = 10;
        const pinHash = await bcrypt.hash(newPin, saltRounds);

        // Restablecer PIN y limpiar datos de reset
        await query(
            `UPDATE usuarios 
             SET pin_hash = $1, 
                 failed_pin_attempts = 0, 
                 pin_locked_until = NULL,
                 reset_code = NULL,
                 reset_code_expires = NULL,
                 reset_code_attempts = 0,
                 reset_id = NULL,
                 pin_created_at = NOW(),
                 biometric_enabled = true
             WHERE id = $2`,
            [pinHash, user.id]
        );

        console.log('🎉 PIN restablecido exitosamente para usuario:', user.id);

        // Enviar email de confirmación
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'PIN Restablecido Exitosamente',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">PIN Restablecido</h2>
                        <p>Hola,</p>
                        <p>Tu PIN de seguridad ha sido restablecido exitosamente.</p>
                        
                        <div style="background-color: #f0f8f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #2d5016;">✅ PIN restablecido correctamente</p>
                        </div>
                        
                        <p>Si no realizaste esta acción, por favor contacta al soporte inmediatamente.</p>
                        
                        <hr style="margin: 30px 0;">
                        <p style="color: #666; font-size: 12px;">
                            Este es un email automático, por favor no respondas.
                        </p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log('📧 Email de confirmación enviado a:', user.email);
        } catch (emailError) {
            console.error('⚠️ Error enviando email de confirmación:', emailError);
            // No fallar la operación principal por error de email
        }

        res.json({
            success: true,
            message: 'PIN restablecido correctamente. Ya puedes iniciar sesión con tu nuevo PIN.'
        });

    } catch (error) {
        console.error('💥 Error restableciendo PIN:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
}

    // Función para verificar estado del código
    static async checkResetCodeStatus(req, res) {
        try {
        const { resetId } = req.body; // ✅ Cambiar de email a resetId

        const userResult = await query(
            `SELECT reset_code_expires, reset_code_attempts 
             FROM usuarios 
             WHERE reset_id = $1 AND reset_code IS NOT NULL`,
            [resetId] // ✅ Usar resetId
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No hay código de restablecimiento activo'
            });
        }

            const user = userResult.rows[0];
            const isExpired = user.reset_code_expires < new Date();
            const attemptsLeft = 3 - user.reset_code_attempts;

            res.json({
                success: true,
                isExpired,
                attemptsLeft,
                expiresAt: user.reset_code_expires
            });

        } catch (error) {
            console.error('Error verificando estado del código:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = BiometricController;