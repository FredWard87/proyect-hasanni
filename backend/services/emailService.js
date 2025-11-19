// services/emailService.js
const { Resend } = require('resend');

class EmailService {
    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY);
        this.fromEmail = 'Hasanni <onboarding@resend.dev>'; 
    }

    async sendEmail(to, subject, html) {
        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: [to],
                subject: subject,
                html: html
            });

            if (error) {
                console.error('❌ Error enviando email:', error);
                throw error;
            }

            console.log('✅ Email enviado exitosamente:', data.id);
            return data;
        } catch (error) {
            console.error('❌ Error en sendEmail:', error);
            throw error;
        }
    }

    // Método específico para alertas de stock
    async sendStockAlert(to, lowStockProducts) {
        const emailSubject = `🚨 Alerta: Productos con Stock Bajo - ${new Date().toLocaleDateString()}`;
        
        let emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                    th { background-color: #f2f2f2; padding: 12px; text-align: left; border: 1px solid #ddd; }
                    td { padding: 10px; border: 1px solid #ddd; }
                    .critico { background-color: #ffcccc; }
                    .alerta { background-color: #fff3cd; }
                    .estado { text-align: center; font-weight: bold; }
                </style>
            </head>
            <body>
                <h2>🚨 Alerta de Stock Bajo</h2>
                <p>Los siguientes productos han alcanzado o están por debajo de su stock mínimo después de una venta:</p>
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th style="text-align: center;">Stock Actual</th>
                            <th style="text-align: center;">Stock Mínimo</th>
                            <th style="text-align: center;">Cantidad Vendida</th>
                            <th style="text-align: center;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        lowStockProducts.forEach(product => {
            const estado = product.stock_actual < product.stock_minimo ? 'CRÍTICO' : 'ALERTA';
            const rowClass = product.stock_actual < product.stock_minimo ? 'critico' : 'alerta';
            
            emailContent += `
                <tr class="${rowClass}">
                    <td>${product.codigo}</td>
                    <td>${product.nombre}</td>
                    <td style="text-align: center;">${product.stock_actual}</td>
                    <td style="text-align: center;">${product.stock_minimo}</td>
                    <td style="text-align: center;">${product.cantidad_vendida}</td>
                    <td class="estado">${estado}</td>
                </tr>
            `;
        });

        emailContent += `
                    </tbody>
                </table>
                <p><strong>⚠️ Acción requerida:</strong> Por favor, realice un pedido de estos productos para reponer el stock.</p>
                <p><strong>📅 Fecha de la alerta:</strong> ${new Date().toLocaleString()}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Este es un mensaje automático del sistema de inventario Hasanni.</p>
            </body>
            </html>
        `;

        return await this.sendEmail(to, emailSubject, emailContent);
    }

    // Método para correos de bienvenida/registro
    async sendWelcomeEmail(to, userName) {
        const subject = '¡Bienvenido a Hasanni! 🎉';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                    .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>¡Bienvenido a Hasanni!</h1>
                    </div>
                    <div class="content">
                        <h2>Hola ${userName},</h2>
                        <p>Gracias por registrarte en Hasanni. Estamos emocionados de tenerte con nosotros.</p>
                        <p>Con tu cuenta podrás:</p>
                        <ul>
                            <li>✅ Gestionar tu inventario</li>
                            <li>✅ Recibir alertas de stock</li>
                            <li>✅ Generar reportes detallados</li>
                            <li>✅ Y mucho más...</li>
                        </ul>
                        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                        <p>¡Que tengas un excelente día!</p>
                        <p><strong>El equipo de Hasanni</strong></p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(to, subject, html);
    }

    // Método para recuperación de contraseña
    async sendPasswordResetEmail(to, resetToken, userName) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        const subject = 'Recuperación de Contraseña - Hasanni';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                    .button { display: inline-block; padding: 12px 30px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔒 Recuperación de Contraseña</h1>
                    </div>
                    <div class="content">
                        <h2>Hola ${userName},</h2>
                        <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                        <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
                        <center>
                            <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
                        </center>
                        <p>O copia y pega este enlace en tu navegador:</p>
                        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                        <div class="warning">
                            <strong>⚠️ Importante:</strong> Este enlace expirará en 1 hora por razones de seguridad.
                        </div>
                        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                        <p><strong>El equipo de Hasanni</strong></p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(to, subject, html);
    }
}

module.exports = new EmailService();