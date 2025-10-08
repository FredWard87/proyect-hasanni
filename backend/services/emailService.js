// services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendEmail(to, subject, html) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: to,
                subject: subject,
                html: html
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Email enviado exitosamente:', result.messageId);
            return result;
        } catch (error) {
            console.error('Error enviando email:', error);
            throw error;
        }
    }

    // Método específico para alertas de stock
    async sendStockAlert(to, lowStockProducts) {
        const emailSubject = `🚨 Alerta: Productos con Stock Bajo - ${new Date().toLocaleDateString()}`;
        
        let emailContent = `
            <h2>Alerta de Stock Bajo</h2>
            <p>Los siguientes productos han alcanzado o están por debajo de su stock mínimo después de una venta:</p>
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 8px; text-align: left;">Código</th>
                        <th style="padding: 8px; text-align: left;">Producto</th>
                        <th style="padding: 8px; text-align: left;">Stock Actual</th>
                        <th style="padding: 8px; text-align: left;">Stock Mínimo</th>
                        <th style="padding: 8px; text-align: left;">Cantidad Vendida</th>
                        <th style="padding: 8px; text-align: left;">Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;

        lowStockProducts.forEach(product => {
            const estado = product.stock_actual < product.stock_minimo ? 'CRÍTICO' : 'ALERTA';
            const color = product.stock_actual < product.stock_minimo ? '#ffcccc' : '#fff3cd';
            
            emailContent += `
                <tr style="background-color: ${color};">
                    <td style="padding: 8px;">${product.codigo}</td>
                    <td style="padding: 8px;">${product.nombre}</td>
                    <td style="padding: 8px; text-align: center;">${product.stock_actual}</td>
                    <td style="padding: 8px; text-align: center;">${product.stock_minimo}</td>
                    <td style="padding: 8px; text-align: center;">${product.cantidad_vendida}</td>
                    <td style="padding: 8px; text-align: center; font-weight: bold;">${estado}</td>
                </tr>
            `;
        });

        emailContent += `
                </tbody>
            </table>
            <br>
            <p><strong>Acción requerida:</strong> Por favor, realice un pedido de estos productos para reponer el stock.</p>
            <p>Fecha de la alerta: ${new Date().toLocaleString()}</p>
        `;

        return await this.sendEmail(to, emailSubject, emailContent);
    }
}

module.exports = new EmailService();