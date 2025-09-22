const crypto = require('crypto');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-that-should-be-32-chars', 'utf8');
    }

    encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.algorithm, this.key);
        cipher.setAAD(Buffer.from('additional-data'));
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            iv: iv.toString('hex'),
            data: encrypted,
            authTag: authTag.toString('hex')
        };
    }

    decrypt(encryptedData) {
        const decipher = crypto.createDecipher(this.algorithm, this.key);
        decipher.setAAD(Buffer.from('additional-data'));
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    // Para cifrar datos sensibles antes de guardar en BD
    encryptSensitiveData(data) {
        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }
        return this.encrypt(data);
    }

    // Para descifrar datos sensibles después de leer de BD
    decryptSensitiveData(encryptedData) {
        try {
            const decrypted = this.decrypt(encryptedData);
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Error descifrando datos:', error);
            return null;
        }
    }
}

module.exports = new EncryptionService();