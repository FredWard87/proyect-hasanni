// services/excelReportService.js - VERSIÓN COMPLETA CORREGIDA
const ExcelJS = require('exceljs');
const { query } = require('../config/database');

class ExcelReportService {
    
    // Generar reporte completo de inventario en Excel
    async generateInventoryReport(incluirStockBajo = true, incluirMetricas = true) {
        const workbook = new ExcelJS.Workbook();
        
        // Hoja de Inventario General
        const inventorySheet = workbook.addWorksheet('Inventario General');
        
        // Configurar columnas
        inventorySheet.columns = [
            { header: 'Código', key: 'codigo', width: 15 },
            { header: 'Nombre', key: 'nombre', width: 30 },
            { header: 'Categoría', key: 'categoria', width: 20 },
            { header: 'Unidad', key: 'unidad', width: 10 },
            { header: 'Stock Mínimo', key: 'stock_minimo', width: 12 },
            { header: 'Stock Actual', key: 'stock', width: 12 }, // CORREGIDO: stock_actual -> stock
            { header: 'Estado', key: 'estado_stock', width: 15 },
            { header: 'Precio', key: 'precio', width: 12 },
            { header: 'Valor Total', key: 'valor_total', width: 15 }
        ];

        // Obtener datos de inventario - CORREGIDO: usar 'stock' en lugar de 'stock_actual'
        const inventoryData = await query(`
            SELECT 
                codigo, nombre, categoria, unidad, stock_minimo, stock,
                precio,
                (stock * precio) as valor_total,
                CASE 
                    WHEN stock < stock_minimo THEN 'STOCK BAJO'
                    WHEN stock = 0 THEN 'SIN STOCK'
                    ELSE 'NORMAL'
                END as estado_stock
            FROM productos 
            WHERE activo = true 
            ORDER BY categoria, nombre
        `);

        // Agregar datos - ASEGURAR QUE SEAN NÚMEROS
        inventoryData.rows.forEach(producto => {
            inventorySheet.addRow({
                codigo: producto.codigo,
                nombre: producto.nombre,
                categoria: producto.categoria,
                unidad: producto.unidad,
                stock_minimo: Number(producto.stock_minimo),
                stock: Number(producto.stock), // CORREGIDO: stock_actual -> stock
                estado_stock: producto.estado_stock,
                precio: Number(producto.precio),
                valor_total: Number(producto.valor_total)
            });
        });

        // Aplicar estilos a la hoja de inventario
        this.applyInventoryStyles(inventorySheet, inventoryData.rows.length);

        // Hoja de Stock Bajo (si se solicita)
        if (incluirStockBajo) {
            await this.addLowStockSheet(workbook);
        }

        // Hoja de Métricas (si se solicita)
        if (incluirMetricas) {
            await this.addMetricsSheet(workbook);
        }

        return workbook;
    }

    // Generar reporte de movimientos en Excel
    async generateMovementsReport(fechaInicio, fechaFin) {
        const workbook = new ExcelJS.Workbook();
        
        // Hoja de Movimientos
        const movementsSheet = workbook.addWorksheet('Movimientos');

        // Configurar columnas
        movementsSheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 20 },
            { header: 'Tipo', key: 'tipo', width: 10 },
            { header: 'Código Producto', key: 'codigo', width: 15 },
            { header: 'Producto', key: 'producto', width: 30 },
            { header: 'Categoría', key: 'categoria', width: 20 },
            { header: 'Cantidad', key: 'cantidad', width: 12 },
            { header: 'Referencia', key: 'referencia', width: 20 },
            { header: 'Documento', key: 'documento', width: 20 },
            { header: 'Responsable', key: 'responsable', width: 20 },
            { header: 'Proveedor/Cliente', key: 'proveedor_cliente', width: 25 },
            { header: 'Observaciones', key: 'observaciones', width: 30 }
        ];

        // Obtener datos de movimientos
        const movementsData = await query(`
            SELECT m.*, p.codigo, p.nombre as producto, p.categoria,
                   COALESCE(prov.nombre, u.nombre) as proveedor_cliente
            FROM movimientos_inventario m
            LEFT JOIN productos p ON m.id_producto = p.id
            LEFT JOIN proveedores prov ON m.id_proveedor = prov.id_proveedor
            LEFT JOIN usuarios u ON m.id_usuario = u.id
            WHERE m.fecha >= $1 AND m.fecha <= $2
            ORDER BY m.fecha DESC
        `, [fechaInicio, fechaFin]);

        // Agregar datos
        movementsData.rows.forEach(movimiento => {
            movementsSheet.addRow({
                fecha: new Date(movimiento.fecha).toLocaleString('es-MX'),
                tipo: movimiento.tipo.toUpperCase(),
                codigo: movimiento.codigo,
                producto: movimiento.producto,
                categoria: movimiento.categoria,
                cantidad: movimiento.cantidad,
                referencia: movimiento.referencia,
                documento: movimiento.documento,
                responsable: movimiento.responsable,
                proveedor_cliente: movimiento.proveedor_cliente,
                observaciones: movimiento.observaciones
            });
        });

        // Aplicar estilos
        this.applyMovementsStyles(movementsSheet, movementsData.rows.length);

        // Hoja de Resumen por Día
        await this.addMovementsSummarySheet(workbook, fechaInicio, fechaFin);

        return workbook;
    }

    // Generar reporte de productos más movidos
    async generateTopProductsReport(dias = 30, limite = 10) {
        const workbook = new ExcelJS.Workbook();
        
        // Hoja de Productos Más Movidos
        const topProductsSheet = workbook.addWorksheet('Productos Más Movidos');

        // Configurar columnas
        topProductsSheet.columns = [
            { header: 'Código', key: 'codigo', width: 15 },
            { header: 'Producto', key: 'producto', width: 30 },
            { header: 'Categoría', key: 'categoria', width: 20 },
            { header: 'Total Movimientos', key: 'total_movimientos', width: 18 },
            { header: 'Total Entradas', key: 'total_entradas', width: 16 },
            { header: 'Total Salidas', key: 'total_salidas', width: 15 },
            { header: 'Neto', key: 'neto', width: 12 },
            { header: 'Stock Actual', key: 'stock', width: 14 } // CORREGIDO: stock_actual -> stock
        ];

        // Obtener datos - CORREGIDO: usar 'stock' en lugar de 'stock_actual'
        const topProductsData = await query(`
            SELECT 
                p.id,
                p.codigo,
                p.nombre as producto,
                p.categoria,
                p.stock,
                COUNT(*) as total_movimientos,
                SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) as total_entradas,
                SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END) as total_salidas,
                (SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) - 
                 SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END)) as neto
            FROM movimientos_inventario m
            JOIN productos p ON m.id_producto = p.id
            WHERE m.fecha >= CURRENT_DATE - INTERVAL '${dias} days'
            GROUP BY p.id, p.codigo, p.nombre, p.categoria, p.stock
            ORDER BY total_movimientos DESC
            LIMIT $1
        `, [limite]);

        // Agregar datos
        topProductsData.rows.forEach(producto => {
            topProductsSheet.addRow({
                codigo: producto.codigo,
                producto: producto.producto,
                categoria: producto.categoria,
                total_movimientos: producto.total_movimientos,
                total_entradas: producto.total_entradas,
                total_salidas: producto.total_salidas,
                neto: producto.neto,
                stock: producto.stock // CORREGIDO: stock_actual -> stock
            });
        });

        // Aplicar estilos
        this.applyTopProductsStyles(topProductsSheet, topProductsData.rows.length);

        return workbook;
    }

    // Métodos auxiliares para estilos
    applyInventoryStyles(sheet, rowCount) {
        // Estilo para encabezados
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2F75B5' }
        };

        // Aplicar bordes y estilos a todas las celdas
        for (let i = 1; i <= rowCount + 1; i++) {
            const row = sheet.getRow(i);
            row.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            row.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Formato de números para precios y valores
        sheet.getColumn('precio').numFmt = '$#,##0.00';
        sheet.getColumn('valor_total').numFmt = '$#,##0.00';

        // Resaltar productos con stock bajo
        for (let i = 2; i <= rowCount + 1; i++) {
            const estadoCell = sheet.getCell(`G${i}`);
            if (estadoCell.value === 'STOCK BAJO') {
                estadoCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFE699' }
                };
            } else if (estadoCell.value === 'SIN STOCK') {
                estadoCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFF9999' }
                };
            }
        }
    }

    applyMovementsStyles(sheet, rowCount) {
        // Estilo para encabezados
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2F75B5' }
        };

        // Aplicar bordes y estilos
        for (let i = 1; i <= rowCount + 1; i++) {
            const row = sheet.getRow(i);
            row.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            row.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Resaltar por tipo de movimiento
        for (let i = 2; i <= rowCount + 1; i++) {
            const tipoCell = sheet.getCell(`B${i}`);
            if (tipoCell.value === 'ENTRADA') {
                tipoCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFC6EFCE' }
                };
            } else if (tipoCell.value === 'SALIDA') {
                tipoCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFC7CE' }
                };
            }
        }
    }

    applyTopProductsStyles(sheet, rowCount) {
        // Estilo para encabezados
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2F75B5' }
        };

        // Aplicar bordes y estilos
        for (let i = 1; i <= rowCount + 1; i++) {
            const row = sheet.getRow(i);
            row.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            row.alignment = { vertical: 'middle', horizontal: 'center' };
        }
    }

    // Métodos para hojas adicionales
    async addLowStockSheet(workbook) {
        const lowStockSheet = workbook.addWorksheet('Stock Bajo');

        lowStockSheet.columns = [
            { header: 'Código', key: 'codigo', width: 15 },
            { header: 'Producto', key: 'nombre', width: 30 },
            { header: 'Categoría', key: 'categoria', width: 20 },
            { header: 'Stock Mínimo', key: 'stock_minimo', width: 15 },
            { header: 'Stock Actual', key: 'stock', width: 15 }, // CORREGIDO: stock_actual -> stock
            { header: 'Diferencia', key: 'diferencia', width: 12 },
            { header: 'Urgencia', key: 'urgencia', width: 15 }
        ];

        // CORREGIDO: usar 'stock' en lugar de 'stock_actual'
        const lowStockData = await query(`
            SELECT 
                codigo, nombre, categoria,
                stock_minimo,
                stock,
                (stock_minimo - stock) as diferencia,
                CASE 
                    WHEN stock = 0 THEN 'CRÍTICO'
                    WHEN stock < stock_minimo * 0.3 THEN 'ALTO'
                    WHEN stock < stock_minimo THEN 'MEDIO'
                    ELSE 'BAJO'
                END as urgencia
            FROM productos 
            WHERE stock < stock_minimo AND activo = true
            ORDER BY (stock_minimo - stock) DESC
        `);

        lowStockData.rows.forEach(producto => {
            lowStockSheet.addRow({
                codigo: producto.codigo,
                nombre: producto.nombre,
                categoria: producto.categoria,
                stock_minimo: Number(producto.stock_minimo),
                stock: Number(producto.stock), // CORREGIDO: stock_actual -> stock
                diferencia: Number(producto.diferencia),
                urgencia: producto.urgencia
            });
        });

        // Aplicar estilos
        lowStockSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        lowStockSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF0000' }
        };
    }

    async addMetricsSheet(workbook) {
        const metricsSheet = workbook.addWorksheet('Métricas');

        // Obtener métricas - CORREGIDO: usar 'stock' en lugar de 'stock_actual'
        const metricsData = await query(`
            SELECT 
                COUNT(*) as total_productos,
                SUM(CASE WHEN stock < stock_minimo THEN 1 ELSE 0 END) as productos_stock_bajo,
                SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as productos_sin_stock,
                ROUND(AVG(stock), 2) as stock_promedio,
                SUM(stock * precio) as valor_total_inventario,
                COUNT(DISTINCT categoria) as categorias_totales
            FROM productos 
            WHERE activo = true
        `);

        const metrics = metricsData.rows[0];
        
        // CONVERTIR A NÚMEROS
        const valorTotal = parseFloat(metrics.valor_total_inventario) || 0;
        const stockPromedio = parseFloat(metrics.stock_promedio) || 0;

        metricsSheet.addRow(['MÉTRICAS DE INVENTARIO']);
        metricsSheet.addRow([]);
        metricsSheet.addRow(['Total de Productos', metrics.total_productos]);
        metricsSheet.addRow(['Productos con Stock Bajo', metrics.productos_stock_bajo]);
        metricsSheet.addRow(['Productos sin Stock', metrics.productos_sin_stock]);
        metricsSheet.addRow(['Stock Promedio', stockPromedio]);
        metricsSheet.addRow(['Valor Total del Inventario', `$${valorTotal.toFixed(2)}`]);
        metricsSheet.addRow(['Categorías Totales', metrics.categorias_totales]);
        metricsSheet.addRow([]);
        metricsSheet.addRow(['Fecha de Generación', new Date().toLocaleString('es-MX')]);

        // Estilos para métricas
        metricsSheet.getCell('A1').font = { bold: true, size: 14 };
        for (let i = 3; i <= 9; i++) {
            metricsSheet.getCell(`A${i}`).font = { bold: true };
        }
    }

    async addMovementsSummarySheet(workbook, fechaInicio, fechaFin) {
        const summarySheet = workbook.addWorksheet('Resumen por Día');

        summarySheet.columns = [
            { header: 'Fecha', key: 'fecha_dia', width: 15 },
            { header: 'Tipo', key: 'tipo', width: 10 },
            { header: 'Cantidad Movimientos', key: 'cantidad_movimientos', width: 20 },
            { header: 'Total Unidades', key: 'total_unidades', width: 15 }
        ];

        const summaryData = await query(`
            SELECT 
                DATE(fecha) as fecha_dia,
                tipo,
                COUNT(*) as cantidad_movimientos,
                SUM(cantidad) as total_unidades
            FROM movimientos_inventario 
            WHERE fecha >= $1 AND fecha <= $2
            GROUP BY DATE(fecha), tipo
            ORDER BY fecha_dia DESC, tipo
        `, [fechaInicio, fechaFin]);

        summaryData.rows.forEach(resumen => {
            summarySheet.addRow({
                fecha_dia: resumen.fecha_dia,
                tipo: resumen.tipo.toUpperCase(),
                cantidad_movimientos: resumen.cantidad_movimientos,
                total_unidades: resumen.total_unidades
            });
        });

        // Estilos
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2F75B5' }
        };
    }
}

module.exports = new ExcelReportService();