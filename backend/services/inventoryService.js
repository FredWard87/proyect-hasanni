const { query } = require('../config/database');

class InventoryService {
    
    // Productos
    async getAllProducts() {
        const result = await query('SELECT * FROM productos WHERE activo = true ORDER BY nombre');
        return result.rows;
    }

    async getProductById(id) {
        const result = await query('SELECT * FROM productos WHERE id = $1 AND activo = true', [id]);
        return result.rows[0];
    }

    async createProduct(productData) {
        const { codigo, nombre, descripcion, categoria, unidad, stock_minimo, precio } = productData;
        const result = await query(
            `INSERT INTO productos 
             (codigo, nombre, descripcion, categoria, unidad, stock_minimo, precio, stock, activo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [codigo, nombre, descripcion, categoria, unidad, stock_minimo, precio || 0, 0, true]
        );
        return result.rows[0];
    }

    async updateProduct(id, productData) {
        const { codigo, nombre, descripcion, categoria, unidad, stock_minimo, precio } = productData;
        const result = await query(
            `UPDATE productos SET 
                codigo = $1, nombre = $2, descripcion = $3, categoria = $4, 
                unidad = $5, stock_minimo = $6, precio = $7, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $8 RETURNING *`,
            [codigo, nombre, descripcion, categoria, unidad, stock_minimo, precio, id]
        );
        return result.rows[0];
    }

    async deleteProduct(id) {
        const result = await query(
            'UPDATE productos SET activo = false, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    // Inventario - CON FILTRO DE ACTIVO/INACTIVO
    async getInventory(filters = {}) {
        let queryStr = 'SELECT * FROM vista_inventario WHERE 1=1';
        const params = [];
        let paramCount = 0;

        // Filtro por estado activo/inactivo
        if (filters.activo !== undefined && filters.activo !== null) {
            paramCount++;
            queryStr += ` AND activo = $${paramCount}`;
            // Convertir string "true"/"false" a booleano si es necesario
            const activoValue = typeof filters.activo === 'string' 
                ? filters.activo.toLowerCase() === 'true' 
                : filters.activo;
            params.push(activoValue);
        } else {
            // Por defecto, mostrar solo activos
            queryStr += ' AND activo = true';
        }

        queryStr += ' ORDER BY estado_stock, nombre';
        
        const result = await query(queryStr, params);
        return result.rows;
    }

    async getLowStockProducts() {
        const result = await query(`
            SELECT * FROM productos 
            WHERE stock < stock_minimo AND activo = true 
            ORDER BY (stock_minimo - stock) DESC
        `);
        return result.rows;
    }

    // Movimientos
    async registerMovement(movementData) {
        const { tipo, id_producto, cantidad, referencia, documento, responsable, id_proveedor, id_usuario, observaciones } = movementData;
        
        const result = await query(
            `INSERT INTO movimientos_inventario 
             (tipo, id_producto, cantidad, referencia, documento, responsable, id_proveedor, id_usuario, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [tipo, id_producto, cantidad, referencia, documento, responsable, id_proveedor, id_usuario, observaciones]
        );
        
        return result.rows[0];
    }

    async getMovimientos(filters = {}) {
        let queryStr = `
            SELECT m.*, p.nombre as producto_nombre, p.codigo,
                   prov.nombre as proveedor_nombre, 
                   u.nombre as usuario_nombre, u.email as usuario_email
            FROM movimientos_inventario m
            LEFT JOIN productos p ON m.id_producto = p.id
            LEFT JOIN proveedores prov ON m.id_proveedor = prov.id_proveedor
            LEFT JOIN usuarios u ON m.id_usuario = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (filters.tipo) {
            paramCount++;
            queryStr += ` AND m.tipo = $${paramCount}`;
            params.push(filters.tipo);
        }

        if (filters.id_producto) {
            paramCount++;
            queryStr += ` AND m.id_producto = $${paramCount}`;
            params.push(filters.id_producto);
        }

        if (filters.fecha_desde) {
            paramCount++;
            queryStr += ` AND m.fecha >= $${paramCount}`;
            params.push(filters.fecha_desde);
        }

        if (filters.fecha_hasta) {
            paramCount++;
            queryStr += ` AND m.fecha <= $${paramCount}`;
            params.push(filters.fecha_hasta);
        }

        queryStr += ` ORDER BY m.fecha DESC LIMIT $${paramCount + 1}`;
        params.push(filters.limit || 100);

        const result = await query(queryStr, params);
        return result.rows;
    }

    // Dashboard
    async getDashboardData() {
        const [resumen, lowStock, recentMovements] = await Promise.all([
            query(`
                SELECT 
                    COUNT(*) as total_productos,
                    SUM(CASE WHEN stock < stock_minimo THEN 1 ELSE 0 END) as productos_stock_bajo,
                    SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as productos_sin_stock,
                    ROUND(AVG(stock), 2) as stock_promedio,
                    SUM(stock * precio) as valor_total_inventario
                FROM productos 
                WHERE activo = true
            `),
            this.getLowStockProducts(),
            this.getMovimientos({ limit: 10 })
        ]);

        return {
            resumen: resumen.rows[0],
            lowStock: lowStock,
            recentMovements: recentMovements
        };
    }

    // Usuarios para movimientos
    async getUsuariosParaMovimientos() {
        const result = await query(`
            SELECT 
                id,
                nombre,
                email,
                rol,
                CONCAT(nombre, ' (', email, ') - ', rol) as display_text
            FROM usuarios 
            WHERE activo = true 
            ORDER BY nombre
        `);
        return result.rows;
    }

    // Proveedores
    async getProveedores() {
        const result = await query('SELECT * FROM proveedores WHERE activo = true ORDER BY nombre');
        return result.rows;
    }

    async createProveedor(proveedorData) {
        const { nombre, telefono, contacto, email, direccion } = proveedorData;
        const result = await query(
            'INSERT INTO proveedores (nombre, telefono, contacto, email, direccion) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, telefono, contacto, email, direccion]
        );
        return result.rows[0];
    }

    async updateProveedor(id, proveedorData) {
        const { nombre, telefono, contacto, email, direccion } = proveedorData;
        const result = await query(
            `UPDATE proveedores SET 
                nombre = $1, telefono = $2, contacto = $3, email = $4, 
                direccion = $5, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_proveedor = $6 RETURNING *`,
            [nombre, telefono, contacto, email, direccion, id]
        );
        return result.rows[0];
    }
}

module.exports = new InventoryService();