// controllers/inventoryController.js
const inventoryService = require('../services/inventoryService');

class InventoryController {
    
    // Obtener inventario completo
    async getInventory(req, res) {
        try {
            const inventory = await inventoryService.getInventory();
            res.json({ success: true, data: inventory });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Obtener productos con stock bajo
    async getLowStock(req, res) {
        try {
            const products = await inventoryService.getLowStockProducts();
            res.json({ success: true, data: products });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Registrar entrada
    async registerEntry(req, res) {
        try {
            const movement = await inventoryService.registerMovement({
                ...req.body,
                tipo: 'entrada'
            });
            res.json({ 
                success: true, 
                data: movement, 
                message: 'Entrada registrada exitosamente' 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Registrar salida
    async registerExit(req, res) {
        try {
            // Usar el usuario autenticado o el especificado en el body
            const id_usuario = req.body.id_usuario || req.user?.userId;
            
            if (!id_usuario) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere identificar al usuario'
                });
            }

            // Verificar que el usuario existe
            const { query } = require('../config/database');
            const userCheck = await query('SELECT id FROM usuarios WHERE id = $1 AND activo = true', [id_usuario]);
            if (userCheck.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Usuario no válido o inactivo'
                });
            }

            const movement = await inventoryService.registerMovement({
                ...req.body,
                tipo: 'salida',
                id_usuario: id_usuario,
                responsable: req.user?.nombre || 'Sistema'
            });
            
            res.json({ 
                success: true, 
                data: movement, 
                message: 'Salida registrada exitosamente' 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Obtener movimientos
    async getMovements(req, res) {
        try {
            const movements = await inventoryService.getMovimientos(req.query);
            res.json({ success: true, data: movements });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Dashboard
    async getDashboard(req, res) {
        try {
            const dashboardData = await inventoryService.getDashboardData();
            res.json({ success: true, data: dashboardData });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Actualizar producto
    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const product = await inventoryService.updateProduct(id, req.body);
            res.json({ 
                success: true, 
                data: product, 
                message: 'Producto actualizado exitosamente' 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Obtener usuarios para movimientos
    async getUsuariosParaMovimientos(req, res) {
        try {
            const usuarios = await inventoryService.getUsuariosParaMovimientos();
            res.json({ success: true, data: usuarios });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Obtener proveedores
    async getProveedores(req, res) {
        try {
            const proveedores = await inventoryService.getProveedores();
            res.json({ success: true, data: proveedores });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Crear proveedor
    async createProveedor(req, res) {
        try {
            const proveedor = await inventoryService.createProveedor(req.body);
            res.json({ 
                success: true, 
                data: proveedor, 
                message: 'Proveedor creado exitosamente' 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Actualizar proveedor
    async updateProveedor(req, res) {
        try {
            const { id } = req.params;
            const proveedor = await inventoryService.updateProveedor(id, req.body);
            res.json({ 
                success: true, 
                data: proveedor, 
                message: 'Proveedor actualizado exitosamente' 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new InventoryController();