const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const jwt = require('jsonwebtoken'); // ← AGREGAR ESTA LÍNEA


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
   // En la función verifyPIN del biometricController.js, agrega logs:
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
   // En controllers/biometricController.js - función getPINStatus
static async getPINStatus(req, res) {
    try {
        const { userId } = req.user;

        const userResult = await query(
            `SELECT biometric_enabled, pin_created_at, failed_pin_attempts, 
                    pin_locked_until, fecha_creacion < NOW() - INTERVAL '1 hour' as is_new_user
             FROM usuarios WHERE id = $1`, // CAMBIAR created_at por fecha_creacion
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
}

module.exports = BiometricController;