// controllers/suppliersController.js
const { query } = require('../config/database');

class SuppliersController {
    
    async getSuppliers(req, res) {
        try {
            const result = await query('SELECT * FROM proveedores WHERE activo = true ORDER BY nombre');
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async createSupplier(req, res) {
        try {
            const { nombre, telefono, contacto, email, direccion } = req.body;
            const result = await query(
                'INSERT INTO proveedores (nombre, telefono, contacto, email, direccion) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [nombre, telefono, contacto, email, direccion]
            );
            res.json({ success: true, data: result.rows[0], message: 'Proveedor creado exitosamente' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async updateSupplier(req, res) {
        try {
            const { id } = req.params;
            const { nombre, telefono, contacto, email, direccion } = req.body;
            const result = await query(
                `UPDATE proveedores SET 
                    nombre = $1, telefono = $2, contacto = $3, email = $4, 
                    direccion = $5, fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id_proveedor = $6 RETURNING *`,
                [nombre, telefono, contacto, email, direccion, id]
            );
            res.json({ success: true, data: result.rows[0], message: 'Proveedor actualizado exitosamente' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new SuppliersController();