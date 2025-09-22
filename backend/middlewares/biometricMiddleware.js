const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const verifyBiometric = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const biometricToken = authHeader && authHeader.split(' ')[1];

        if (!biometricToken) {
            return res.status(401).json({
                success: false,
                message: 'Se requiere autenticación biométrica',
                requiresBiometric: true
            });
        }

        // Verificar token biométrico
        const decoded = jwt.verify(biometricToken, process.env.JWT_SECRET);
        
        if (!decoded.biometric || decoded.type !== 'biometric_session') {
            return res.status(401).json({
                success: false,
                message: 'Token biométrico inválido',
                requiresBiometric: true
            });
        }

        // Verificar que el usuario tenga biométrico habilitado
        const userResult = await query(
            'SELECT id, biometric_enabled FROM usuarios WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].biometric_enabled) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación biométrica no configurada',
                requiresBiometric: true
            });
        }

        // Agregar información al request
        req.user = {
            userId: decoded.userId,
            biometricVerified: true
        };

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Sesión biométrica expirada',
                requiresBiometric: true,
                expired: true
            });
        }

        console.error('Error en middleware biométrico:', error);
        res.status(401).json({
            success: false,
            message: 'Error de autenticación biométrica',
            requiresBiometric: true
        });
    }
};

// Middleware para verificar si requiere setup de PIN
// En middlewares/biometricMiddleware.js - función checkBiometricSetup
const checkBiometricSetup = async (req, res, next) => {
    try {
        const { userId } = req.user;

        const userResult = await query(
            `SELECT biometric_enabled, fecha_creacion < NOW() - INTERVAL '1 hour' as is_new_user
             FROM usuarios WHERE id = $1`, // CAMBIAR created_at por fecha_creacion
            [userId]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            req.requiresBiometricSetup = !user.biometric_enabled && user.is_new_user;
        }

        next();
    } catch (error) {
        console.error('Error verificando setup biométrico:', error);
        req.requiresBiometricSetup = false;
        next();
    }
};

module.exports = {
    verifyBiometric,
    checkBiometricSetup
};