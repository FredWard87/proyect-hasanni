// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Reporte por categorías
router.get('/categories', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                categoria,
                COUNT(*) as cantidad_productos,
                SUM(stock) as total_stock,
                ROUND(AVG(stock), 2) as promedio_stock,
                SUM(stock * precio) as valor_total
            FROM productos 
            WHERE activo = true
            GROUP BY categoria
            ORDER BY valor_total DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reporte de movimientos por período
router.get('/movements-by-period', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const result = await query(`
            SELECT 
                DATE(fecha) as fecha_dia,
                tipo,
                COUNT(*) as cantidad_movimientos,
                SUM(cantidad) as total_unidades
            FROM movimientos_inventario 
            WHERE fecha >= $1 AND fecha <= $2
            GROUP BY DATE(fecha), tipo
            ORDER BY fecha_dia DESC, tipo
        `, [startDate, endDate]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reporte de productos más movidos
router.get('/top-products', async (req, res) => {
    try {
        const { limit = 10, days = 30 } = req.query;
        const result = await query(`
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                p.categoria,
                COUNT(*) as total_movimientos,
                SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) as total_entradas,
                SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END) as total_salidas,
                (SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) - 
                 SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END)) as neto
            FROM movimientos_inventario m
            JOIN productos p ON m.id_producto = p.id
            WHERE m.fecha >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY p.id, p.codigo, p.nombre, p.categoria
            ORDER BY total_movimientos DESC
            LIMIT $1
        `, [limit]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;