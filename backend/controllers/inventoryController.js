// controllers/inventoryController.js
const inventoryService = require('../services/inventoryService');

class InventoryController {
    
    // Obtener inventario completo - CON FILTRO DE ACTIVO/INACTIVO
    async getInventory(req, res) {
        try {
            const filters = {};
            if (req.query.activo !== undefined) {
                filters.activo = req.query.activo;
            }
            
            const inventory = await inventoryService.getInventory(filters);
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

    // Crear producto - CON VALIDACIONES COMPLETAS
    async createProduct(req, res) {
        try {
            const { codigo, nombre, descripcion, categoria, unidad, stock_minimo, precio } = req.body;
            const errors = [];

            // Validación de tipos
            if (codigo !== undefined && typeof codigo !== 'string') {
                errors.push('El código debe ser texto');
            }

            if (nombre !== undefined && typeof nombre !== 'string') {
                errors.push('El nombre debe ser texto');
            }

            if (descripcion !== undefined && descripcion !== null && typeof descripcion !== 'string') {
                errors.push('La descripción debe ser texto');
            }

            if (categoria !== undefined && typeof categoria !== 'string') {
                errors.push('La categoría debe ser texto');
            }

            if (unidad !== undefined && typeof unidad !== 'string') {
                errors.push('La unidad debe ser texto');
            }

            // Validaciones de campos requeridos
            if (!codigo || (typeof codigo === 'string' && codigo.trim() === '')) {
                errors.push('El código del producto es obligatorio');
            }

            if (!nombre || (typeof nombre === 'string' && nombre.trim() === '')) {
                errors.push('El nombre del producto es obligatorio');
            }

            if (!categoria || (typeof categoria === 'string' && categoria.trim() === '')) {
                errors.push('La categoría es obligatoria');
            }

            if (!unidad || (typeof unidad === 'string' && unidad.trim() === '')) {
                errors.push('La unidad de medida es obligatoria');
            }

            if (stock_minimo === undefined || stock_minimo === null) {
                errors.push('El stock mínimo es obligatorio');
            }

            // Validaciones de formato y tipos
            if (nombre && typeof nombre === 'string') {
                if (nombre.trim().length < 3) {
                    errors.push('El nombre debe tener al menos 3 caracteres');
                }
                if (nombre.trim().length > 100) {
                    errors.push('El nombre no puede exceder 100 caracteres');
                }
            }

            if (categoria && typeof categoria === 'string') {
                if (categoria.trim().length < 2) {
                    errors.push('La categoría debe tener al menos 2 caracteres');
                }
                if (categoria.trim().length > 50) {
                    errors.push('La categoría no puede exceder 50 caracteres');
                }
            }

            if (codigo && typeof codigo === 'string' && codigo.trim().length > 50) {
                errors.push('El código no puede exceder 50 caracteres');
            }

            if (descripcion && typeof descripcion === 'string' && descripcion.trim().length > 500) {
                errors.push('La descripción no puede exceder 500 caracteres');
            }

            if (categoria && typeof categoria === 'string') {
                if (categoria.trim().length < 2) {
                    errors.push('La categoría debe tener al menos 2 caracteres');
                }
                if (categoria.trim().length > 50) {
                    errors.push('La categoría no puede exceder 50 caracteres');
                }
            }

            if (unidad && typeof unidad === 'string' && unidad.trim().length > 50) {
                errors.push('La unidad no puede exceder 50 caracteres');
            }

            // Validaciones numéricas
            if (stock_minimo !== undefined && stock_minimo !== null) {
                if (!Number.isInteger(Number(stock_minimo))) {
                    errors.push('El stock mínimo debe ser un número entero');
                } else if (Number(stock_minimo) < 0) {
                    errors.push('El stock mínimo no puede ser negativo');
                } else if (Number(stock_minimo) > 999999) {
                    errors.push('El stock mínimo no puede exceder 999999');
                }
            }

            if (precio !== undefined && precio !== null) {
                if (isNaN(precio)) {
                    errors.push('El precio debe ser un número válido');
                } else if (Number(precio) < 0) {
                    errors.push('El precio no puede ser negativo');
                } else if (Number(precio) > 999999.99) {
                    errors.push('El precio no puede exceder 999999.99');
                }
            }

            // Si hay errores, retornar
            if (errors.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Error de validación',
                    errors: errors 
                });
            }

            // Validar que el código sea único
            const { query } = require('../config/database');
            const codigoCheck = await query('SELECT id FROM productos WHERE codigo = $1', [codigo.trim()]);
            if (codigoCheck.rows.length > 0) {
                return res.status(409).json({ 
                    success: false, 
                    message: `El código "${codigo}" ya está registrado para otro producto` 
                });
            }

            // Crear el producto
            const product = await inventoryService.createProduct({
                codigo: codigo.trim(),
                nombre: nombre.trim(),
                descripcion: descripcion ? descripcion.trim() : null,
                categoria: categoria.trim(),
                unidad: unidad.trim(),
                stock_minimo: Number(stock_minimo),
                precio: precio ? Number(precio) : 0
            });

            res.status(201).json({ 
                success: true, 
                data: product, 
                message: 'Producto creado exitosamente' 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Registrar entrada
    async registerEntry(req, res) {
        try {
            const { id_producto, cantidad, referencia, documento, responsable, id_proveedor, observaciones } = req.body;
            const errors = [];

            // Validaciones de campos requeridos
            if (!id_producto) {
                errors.push('El ID del producto es obligatorio');
            }

            if (!cantidad) {
                errors.push('La cantidad es obligatoria');
            }

            if (!referencia || referencia.trim() === '') {
                errors.push('La referencia es obligatoria');
            }

            if (!responsable || responsable.trim() === '') {
                errors.push('El responsable es obligatorio');
            }

            if (!id_proveedor) {
                errors.push('El ID del proveedor es obligatorio');
            }

            // Validaciones numéricas
            if (cantidad !== undefined && cantidad !== null) {
                if (!Number.isInteger(Number(cantidad))) {
                    errors.push('La cantidad debe ser un número entero');
                } else if (Number(cantidad) <= 0) {
                    errors.push('La cantidad debe ser mayor a 0');
                } else if (Number(cantidad) > 999999) {
                    errors.push('La cantidad no puede exceder 999999');
                }
            }

            // Validaciones de longitud
            if (referencia && referencia.trim().length > 50) {
                errors.push('La referencia no puede exceder 50 caracteres');
            }

            if (documento && documento.trim().length > 50) {
                errors.push('El documento no puede exceder 50 caracteres');
            }

            if (responsable && responsable.trim().length > 100) {
                errors.push('El responsable no puede exceder 100 caracteres');
            }

            if (observaciones && observaciones.trim().length > 500) {
                errors.push('Las observaciones no pueden exceder 500 caracteres');
            }

            if (errors.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Error de validación',
                    errors: errors 
                });
            }

            // Validar que el producto existe y está activo
            const { query } = require('../config/database');
            const productCheck = await query('SELECT id, activo FROM productos WHERE id = $1', [id_producto]);
            if (productCheck.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Producto no encontrado' 
                });
            }

            if (!productCheck.rows[0].activo) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'No se puede registrar entrada para un producto inactivo' 
                });
            }

            // Validar que el proveedor existe
            const proveedorCheck = await query('SELECT id_proveedor FROM proveedores WHERE id_proveedor = $1 AND activo = true', [id_proveedor]);
            if (proveedorCheck.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Proveedor no encontrado o inactivo' 
                });
            }

            const movement = await inventoryService.registerMovement({
                tipo: 'entrada',
                id_producto,
                cantidad: Number(cantidad),
                referencia: referencia.trim(),
                documento: documento ? documento.trim() : null,
                responsable: responsable.trim(),
                id_proveedor,
                id_usuario: null,
                observaciones: observaciones ? observaciones.trim() : null
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
            const { id_producto, cantidad, referencia, documento, responsable, id_usuario, observaciones } = req.body;
            const errors = [];

            // Validaciones de campos requeridos
            if (!id_producto) {
                errors.push('El ID del producto es obligatorio');
            }

            if (!cantidad) {
                errors.push('La cantidad es obligatoria');
            }

            if (!referencia || referencia.trim() === '') {
                errors.push('La referencia es obligatoria');
            }

            if (!responsable || responsable.trim() === '') {
                errors.push('El responsable es obligatorio');
            }

            // Validaciones numéricas
            if (cantidad !== undefined && cantidad !== null) {
                if (!Number.isInteger(Number(cantidad))) {
                    errors.push('La cantidad debe ser un número entero');
                } else if (Number(cantidad) <= 0) {
                    errors.push('La cantidad debe ser mayor a 0');
                } else if (Number(cantidad) > 999999) {
                    errors.push('La cantidad no puede exceder 999999');
                }
            }

            // Validaciones de longitud
            if (referencia && referencia.trim().length > 50) {
                errors.push('La referencia no puede exceder 50 caracteres');
            }

            if (documento && documento.trim().length > 50) {
                errors.push('El documento no puede exceder 50 caracteres');
            }

            if (responsable && responsable.trim().length > 100) {
                errors.push('El responsable no puede exceder 100 caracteres');
            }

            if (observaciones && observaciones.trim().length > 500) {
                errors.push('Las observaciones no pueden exceder 500 caracteres');
            }

            if (errors.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Error de validación',
                    errors: errors 
                });
            }

            // Obtener ID del usuario
            const finalUserId = id_usuario || req.user?.userId;
            
            if (!finalUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere identificar al usuario'
                });
            }

            // Validar que el producto existe y está activo
            const { query } = require('../config/database');
            const productCheck = await query('SELECT id, activo, stock FROM productos WHERE id = $1', [id_producto]);
            if (productCheck.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Producto no encontrado' 
                });
            }

            if (!productCheck.rows[0].activo) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'No se puede registrar salida para un producto inactivo' 
                });
            }

            // Validar stock disponible
            if (productCheck.rows[0].stock < Number(cantidad)) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Stock insuficiente. Stock disponible: ${productCheck.rows[0].stock}, cantidad solicitada: ${cantidad}` 
                });
            }

            // Validar que el usuario existe y está activo
            const userCheck = await query('SELECT id FROM usuarios WHERE id = $1 AND activo = true', [finalUserId]);
            if (userCheck.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Usuario no válido o inactivo'
                });
            }

            const movement = await inventoryService.registerMovement({
                tipo: 'salida',
                id_producto,
                cantidad: Number(cantidad),
                referencia: referencia.trim(),
                documento: documento ? documento.trim() : null,
                responsable: responsable.trim(),
                id_proveedor: null,
                id_usuario: finalUserId,
                observaciones: observaciones ? observaciones.trim() : null
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

    // Actualizar producto - CON VALIDACIONES
    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const { codigo, nombre, descripcion, categoria, unidad, stock_minimo, precio } = req.body;
            const errors = [];

            // Validar que el ID sea válido
            if (!id || isNaN(id)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'El ID del producto debe ser un número válido' 
                });
            }

            // Validación de tipos
            if (codigo !== undefined && typeof codigo !== 'string') {
                errors.push('El código debe ser texto');
            }

            if (nombre !== undefined && typeof nombre !== 'string') {
                errors.push('El nombre debe ser texto');
            }

            if (descripcion !== undefined && descripcion !== null && typeof descripcion !== 'string') {
                errors.push('La descripción debe ser texto');
            }

            if (categoria !== undefined && typeof categoria !== 'string') {
                errors.push('La categoría debe ser texto');
            }

            if (unidad !== undefined && typeof unidad !== 'string') {
                errors.push('La unidad debe ser texto');
            }

            // Validaciones de campos requeridos si se proporcionan
            if (nombre !== undefined && (!nombre || (typeof nombre === 'string' && nombre.trim() === ''))) {
                errors.push('El nombre del producto no puede estar vacío');
            }

            if (categoria !== undefined && (!categoria || (typeof categoria === 'string' && categoria.trim() === ''))) {
                errors.push('La categoría no puede estar vacía');
            }

            if (unidad !== undefined && (!unidad || (typeof unidad === 'string' && unidad.trim() === ''))) {
                errors.push('La unidad de medida no puede estar vacía');
            }

            // Validaciones de formato y tipos
            if (nombre && typeof nombre === 'string' && nombre.trim().length < 3) {
                errors.push('El nombre debe tener al menos 3 caracteres');
            }

            if (nombre && typeof nombre === 'string' && nombre.trim().length > 100) {
                errors.push('El nombre no puede exceder 100 caracteres');
            }

            if (codigo && typeof codigo === 'string' && codigo.trim().length > 50) {
                errors.push('El código no puede exceder 50 caracteres');
            }

            if (descripcion && typeof descripcion === 'string' && descripcion.trim().length > 500) {
                errors.push('La descripción no puede exceder 500 caracteres');
            }

            if (categoria && typeof categoria === 'string' && categoria.trim().length > 50) {
                errors.push('La categoría no puede exceder 50 caracteres');
            }

            if (unidad && typeof unidad === 'string' && unidad.trim().length > 50) {
                errors.push('La unidad no puede exceder 50 caracteres');
            }

            // Validaciones numéricas
            if (stock_minimo !== undefined && stock_minimo !== null) {
                if (!Number.isInteger(Number(stock_minimo))) {
                    errors.push('El stock mínimo debe ser un número entero');
                } else if (Number(stock_minimo) < 0) {
                    errors.push('El stock mínimo no puede ser negativo');
                } else if (Number(stock_minimo) > 999999) {
                    errors.push('El stock mínimo no puede exceder 999999');
                }
            }

            if (precio !== undefined && precio !== null) {
                if (isNaN(precio)) {
                    errors.push('El precio debe ser un número válido');
                } else if (Number(precio) < 0) {
                    errors.push('El precio no puede ser negativo');
                } else if (Number(precio) > 999999.99) {
                    errors.push('El precio no puede exceder 999999.99');
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Error de validación',
                    errors: errors 
                });
            }

            // Validar que el producto existe
            const { query } = require('../config/database');
            const productCheck = await query('SELECT id FROM productos WHERE id = $1', [id]);
            if (productCheck.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Producto no encontrado' 
                });
            }

            // Validar que el código sea único (si se proporciona)
            if (codigo) {
                const codigoCheck = await query('SELECT id FROM productos WHERE codigo = $1 AND id != $2', [codigo.trim(), id]);
                if (codigoCheck.rows.length > 0) {
                    return res.status(409).json({ 
                        success: false, 
                        message: `El código "${codigo}" ya está registrado para otro producto` 
                    });
                }
            }

            const product = await inventoryService.updateProduct(id, {
                codigo: codigo ? codigo.trim() : undefined,
                nombre: nombre ? nombre.trim() : undefined,
                descripcion: descripcion ? descripcion.trim() : undefined,
                categoria: categoria ? categoria.trim() : undefined,
                unidad: unidad ? unidad.trim() : undefined,
                stock_minimo: stock_minimo !== undefined ? Number(stock_minimo) : undefined,
                precio: precio !== undefined ? Number(precio) : undefined
            });

            res.json({ 
                success: true, 
                data: product, 
                message: 'Producto actualizado exitosamente' 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Eliminar producto (eliminación lógica) - CON VALIDACIONES
    async deleteProduct(req, res) {
        try {
            const { id } = req.params;

            // Validar que el ID sea válido
            if (!id || isNaN(id)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'El ID del producto debe ser un número válido' 
                });
            }

            // Verificar que el producto existe
            const { query } = require('../config/database');
            const productCheck = await query('SELECT id, activo, nombre FROM productos WHERE id = $1', [id]);
            
            if (productCheck.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Producto no encontrado' 
                });
            }

            const product = productCheck.rows[0];

            // Validar si el producto ya está inactivo
            if (!product.activo) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Este producto "${product.nombre}" ya no está disponible (ya ha sido eliminado previamente)`,
                    code: 'PRODUCT_ALREADY_INACTIVE'
                });
            }

            // Proceder a eliminar el producto
            await inventoryService.deleteProduct(id);
            res.json({ 
                success: true, 
                message: `Producto "${product.nombre}" eliminado exitosamente` 
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

    // Crear proveedor - CON VALIDACIONES
    async createProveedor(req, res) {
        try {
            const { nombre, telefono, contacto, email, direccion } = req.body;
            const errors = [];

            // Validación de tipos
            if (nombre !== undefined && typeof nombre !== 'string') {
                errors.push('El nombre debe ser texto');
            }

            if (telefono !== undefined && telefono !== null && typeof telefono !== 'string') {
                errors.push('El teléfono debe ser texto');
            }

            if (contacto !== undefined && contacto !== null && typeof contacto !== 'string') {
                errors.push('El contacto debe ser texto');
            }

            if (email !== undefined && email !== null && typeof email !== 'string') {
                errors.push('El email debe ser texto');
            }

            if (direccion !== undefined && direccion !== null && typeof direccion !== 'string') {
                errors.push('La dirección debe ser texto');
            }

            // Validaciones de campos requeridos
            if (!nombre || (typeof nombre === 'string' && nombre.trim() === '')) {
                errors.push('El nombre del proveedor es obligatorio');
            }

            // Validaciones de formato
            if (nombre && typeof nombre === 'string') {
                if (nombre.trim().length < 3) {
                    errors.push('El nombre debe tener al menos 3 caracteres');
                }
                if (nombre.trim().length > 100) {
                    errors.push('El nombre no puede exceder 100 caracteres');
                }
            }

            if (telefono && typeof telefono === 'string' && telefono.trim().length > 20) {
                errors.push('El teléfono no puede exceder 20 caracteres');
            }

            if (contacto && typeof contacto === 'string' && contacto.trim().length > 100) {
                errors.push('El contacto no puede exceder 100 caracteres');
            }

            if (email && typeof email === 'string' && email.trim().length > 100) {
                errors.push('El email no puede exceder 100 caracteres');
            }

            // Validar formato de email si se proporciona
            if (email && typeof email === 'string' && email.trim() !== '') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email.trim())) {
                    errors.push('El formato del email es inválido');
                }
            }

            if (direccion && typeof direccion === 'string' && direccion.trim().length > 500) {
                errors.push('La dirección no puede exceder 500 caracteres');
            }

            if (errors.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Error de validación',
                    errors: errors 
                });
            }

            // Validar que el nombre sea único
            const { query } = require('../config/database');
            const nombreCheck = await query('SELECT id_proveedor FROM proveedores WHERE nombre = $1', [nombre.trim()]);
            if (nombreCheck.rows.length > 0) {
                return res.status(409).json({ 
                    success: false, 
                    message: `El proveedor "${nombre}" ya existe en el sistema` 
                });
            }

            const proveedor = await inventoryService.createProveedor({
                nombre: nombre.trim(),
                telefono: telefono && typeof telefono === 'string' ? telefono.trim() : null,
                contacto: contacto && typeof contacto === 'string' ? contacto.trim() : null,
                email: email && typeof email === 'string' ? email.trim() : null,
                direccion: direccion && typeof direccion === 'string' ? direccion.trim() : null
            });

            res.json({ 
                success: true, 
                data: proveedor, 
                message: 'Proveedor creado exitosamente' 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Actualizar proveedor - CON VALIDACIONES
    async updateProveedor(req, res) {
        try {
            const { id } = req.params;
            const { nombre, telefono, contacto, email, direccion } = req.body;
            const errors = [];

            // Validar que el ID sea válido
            if (!id || isNaN(id)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'El ID del proveedor debe ser un número válido' 
                });
            }

            // Validación de tipos
            if (nombre !== undefined && typeof nombre !== 'string') {
                errors.push('El nombre debe ser texto');
            }

            if (telefono !== undefined && telefono !== null && typeof telefono !== 'string') {
                errors.push('El teléfono debe ser texto');
            }

            if (contacto !== undefined && contacto !== null && typeof contacto !== 'string') {
                errors.push('El contacto debe ser texto');
            }

            if (email !== undefined && email !== null && typeof email !== 'string') {
                errors.push('El email debe ser texto');
            }

            if (direccion !== undefined && direccion !== null && typeof direccion !== 'string') {
                errors.push('La dirección debe ser texto');
            }

            // Validaciones de formato
            if (nombre && typeof nombre === 'string' && nombre.trim().length < 3) {
                errors.push('El nombre debe tener al menos 3 caracteres');
            }

            if (nombre && typeof nombre === 'string' && nombre.trim().length > 100) {
                errors.push('El nombre no puede exceder 100 caracteres');
            }

            if (telefono && typeof telefono === 'string' && telefono.trim().length > 20) {
                errors.push('El teléfono no puede exceder 20 caracteres');
            }

            if (contacto && typeof contacto === 'string' && contacto.trim().length > 100) {
                errors.push('El contacto no puede exceder 100 caracteres');
            }

            if (email && typeof email === 'string' && email.trim().length > 100) {
                errors.push('El email no puede exceder 100 caracteres');
            }

            // Validar formato de email si se proporciona
            if (email && typeof email === 'string' && email.trim() !== '') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email.trim())) {
                    errors.push('El formato del email es inválido');
                }
            }

            if (direccion && typeof direccion === 'string' && direccion.trim().length > 500) {
                errors.push('La dirección no puede exceder 500 caracteres');
            }

            if (errors.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Error de validación',
                    errors: errors 
                });
            }

            // Validar que el proveedor existe
            const { query } = require('../config/database');
            const proveedorCheck = await query('SELECT id_proveedor FROM proveedores WHERE id_proveedor = $1', [id]);
            if (proveedorCheck.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Proveedor no encontrado' 
                });
            }

            // Validar que el nombre sea único (si se proporciona)
            if (nombre) {
                const nombreCheck = await query('SELECT id_proveedor FROM proveedores WHERE nombre = $1 AND id_proveedor != $2', [nombre.trim(), id]);
                if (nombreCheck.rows.length > 0) {
                    return res.status(409).json({ 
                        success: false, 
                        message: `El nombre "${nombre}" ya está registrado para otro proveedor` 
                    });
                }
            }

            const proveedor = await inventoryService.updateProveedor(id, {
                nombre: nombre && typeof nombre === 'string' ? nombre.trim() : undefined,
                telefono: telefono && typeof telefono === 'string' ? telefono.trim() : undefined,
                contacto: contacto && typeof contacto === 'string' ? contacto.trim() : undefined,
                email: email && typeof email === 'string' ? email.trim() : undefined,
                direccion: direccion && typeof direccion === 'string' ? direccion.trim() : undefined
            });

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