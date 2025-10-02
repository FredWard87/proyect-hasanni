// controllers/excelReportController.js - VERSIÓN COMPLETAMENTE REFACTORIZADA
const excelReportService = require('../services/excelReportService');
const ExcelJS = require('exceljs');

// Función auxiliar FUERA de la clase para copiar hojas de trabajo
function copySheetToWorkbook(sourceSheet, targetWorkbook, sheetName) {
    try {
        const targetSheet = targetWorkbook.addWorksheet(sheetName);
        
        // Copiar datos fila por fila
        sourceSheet.eachRow((row, rowNumber) => {
            const newRow = targetSheet.getRow(rowNumber);
            
            // Copiar valores de celda
            row.eachCell((cell, colNumber) => {
                const newCell = newRow.getCell(colNumber);
                newCell.value = cell.value;
                
                // Copiar estilos básicos
                if (cell.font) {
                    newCell.font = { ...cell.font };
                }
                if (cell.fill) {
                    newCell.fill = { ...cell.fill };
                }
                if (cell.border) {
                    newCell.border = { ...cell.border };
                }
                if (cell.alignment) {
                    newCell.alignment = { ...cell.alignment };
                }
                if (cell.numFmt) {
                    newCell.numFmt = cell.numFmt;
                }
            });
            
            newRow.commit();
        });

        // Copiar anchos de columnas
        sourceSheet.columns.forEach((column, index) => {
            if (column && column.width) {
                targetSheet.getColumn(index + 1).width = column.width;
            }
        });

        return targetSheet;
    } catch (error) {
        console.error(`Error copiando hoja ${sheetName}:`, error);
        throw error;
    }
}

class ExcelReportController {
    
    // Generar reporte de inventario en Excel
    async generateInventoryReport(req, res) {
        try {
            const { incluir_stock_bajo = true, incluir_metricas = true } = req.query;

            const workbook = await excelReportService.generateInventoryReport(
                incluir_stock_bajo === 'true',
                incluir_metricas === 'true'
            );

            // Configurar headers para descarga
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_inventario_${new Date().toISOString().split('T')[0]}.xlsx"`);

            // Escribir el workbook en la respuesta
            await workbook.xlsx.write(res);
            
            res.end();

        } catch (error) {
            console.error('Error generando reporte de inventario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al generar el reporte de inventario'
            });
        }
    }

    // Generar reporte de movimientos en Excel
    async generateMovementsReport(req, res) {
        try {
            const { fecha_inicio, fecha_fin } = req.query;

            if (!fecha_inicio || !fecha_fin) {
                return res.status(400).json({
                    success: false,
                    error: 'Las fechas de inicio y fin son requeridas'
                });
            }

            const workbook = await excelReportService.generateMovementsReport(fecha_inicio, fecha_fin);

            // Configurar headers para descarga
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_movimientos_${fecha_inicio}_a_${fecha_fin}.xlsx"`);

            // Escribir el workbook en la respuesta
            await workbook.xlsx.write(res);
            
            res.end();

        } catch (error) {
            console.error('Error generando reporte de movimientos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al generar el reporte de movimientos'
            });
        }
    }

    // Generar reporte de productos más movidos en Excel
    async generateTopProductsReport(req, res) {
        try {
            const { dias = 30, limite = 10 } = req.query;

            const workbook = await excelReportService.generateTopProductsReport(
                parseInt(dias),
                parseInt(limite)
            );

            // Configurar headers para descarga
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_productos_movidos_${dias}dias.xlsx"`);

            // Escribir el workbook en la respuesta
            await workbook.xlsx.write(res);
            
            res.end();

        } catch (error) {
            console.error('Error generando reporte de productos movidos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al generar el reporte de productos más movidos'
            });
        }
    }

    // Generar reporte completo del sistema
    async generateFullSystemReport(req, res) {
        try {
            const { fecha_inicio, fecha_fin, dias = 30 } = req.query;

            // Crear workbook principal
            const workbook = new ExcelJS.Workbook();

            // 1. Agregar información del reporte
            const infoSheet = workbook.addWorksheet('Información del Reporte');
            infoSheet.addRow(['REPORTE COMPLETO DEL SISTEMA']);
            infoSheet.addRow([]);
            infoSheet.addRow(['Generado el', new Date().toLocaleString('es-MX')]);
            infoSheet.addRow(['Por', req.user?.nombre || 'Sistema']);
            infoSheet.addRow(['Email', req.user?.email || 'N/A']);
            infoSheet.addRow([]);
            infoSheet.addRow(['Este reporte incluye:']);
            infoSheet.addRow(['- Inventario completo con métricas']);
            
            if (fecha_inicio && fecha_fin) {
                infoSheet.addRow([`- Movimientos del ${fecha_inicio} al ${fecha_fin}`]);
            } else {
                infoSheet.addRow(['- Movimientos (últimos 30 días)']);
            }
            
            infoSheet.addRow([`- Productos más movidos (últimos ${dias} días)`]);

            // Aplicar estilos a la hoja de información
            infoSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF2F75B5' } };
            for (let i = 3; i <= 10; i++) {
                infoSheet.getCell(`A${i}`).font = { bold: true };
            }

            // 2. Generar reporte de inventario
            try {
                console.log('📊 Generando reporte de inventario...');
                const inventoryWorkbook = await excelReportService.generateInventoryReport(true, true);
                
                if (inventoryWorkbook) {
                    const inventorySheet = inventoryWorkbook.getWorksheet('Inventario General');
                    if (inventorySheet) {
                        copySheetToWorkbook(inventorySheet, workbook, 'Inventario General');
                        console.log('✅ Inventario General copiado');
                    }
                    
                    const lowStockSheet = inventoryWorkbook.getWorksheet('Stock Bajo');
                    if (lowStockSheet) {
                        copySheetToWorkbook(lowStockSheet, workbook, 'Stock Bajo');
                        console.log('✅ Stock Bajo copiado');
                    }
                    
                    const metricsSheet = inventoryWorkbook.getWorksheet('Métricas');
                    if (metricsSheet) {
                        copySheetToWorkbook(metricsSheet, workbook, 'Métricas');
                        console.log('✅ Métricas copiadas');
                    }
                }
            } catch (error) {
                console.error('❌ Error copiando inventario:', error);
                console.error('Stack trace:', error.stack);
                // Continuar con otros reportes
            }

            // 3. Generar reporte de movimientos
            try {
                console.log('📊 Generando reporte de movimientos...');
                const movStartDate = fecha_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const movEndDate = fecha_fin || new Date().toISOString().split('T')[0];
                
                const movementsWorkbook = await excelReportService.generateMovementsReport(movStartDate, movEndDate);
                
                if (movementsWorkbook) {
                    const movementsSheet = movementsWorkbook.getWorksheet('Movimientos');
                    if (movementsSheet) {
                        copySheetToWorkbook(movementsSheet, workbook, 'Movimientos');
                        console.log('✅ Movimientos copiados');
                    }
                    
                    const summarySheet = movementsWorkbook.getWorksheet('Resumen por Día');
                    if (summarySheet) {
                        copySheetToWorkbook(summarySheet, workbook, 'Resumen Movimientos');
                        console.log('✅ Resumen Movimientos copiado');
                    }
                }
            } catch (error) {
                console.error('❌ Error copiando movimientos:', error);
                console.error('Stack trace:', error.stack);
                // Continuar con otros reportes
            }

            // 4. Generar reporte de productos más movidos
            try {
                console.log('📊 Generando reporte de productos más movidos...');
                const topProductsWorkbook = await excelReportService.generateTopProductsReport(parseInt(dias), 15);
                
                if (topProductsWorkbook) {
                    const topProductsSheet = topProductsWorkbook.getWorksheet('Productos Más Movidos');
                    if (topProductsSheet) {
                        copySheetToWorkbook(topProductsSheet, workbook, 'Productos Más Movidos');
                        console.log('✅ Productos Más Movidos copiados');
                    }
                }
            } catch (error) {
                console.error('❌ Error copiando productos movidos:', error);
                console.error('Stack trace:', error.stack);
                // Continuar sin esta hoja
            }

            // Verificar que el workbook tenga hojas
            if (workbook.worksheets.length === 1) {
                console.warn('⚠️ Solo se generó la hoja de información, revisar servicios individuales');
                infoSheet.addRow([]);
                infoSheet.addRow(['ADVERTENCIA: No se pudieron generar las hojas de datos principales']);
                infoSheet.addRow(['Por favor, verifique los logs del servidor para más detalles']);
            }

            // Configurar headers para descarga
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_completo_sistema_${new Date().toISOString().split('T')[0]}.xlsx"`);

            console.log('✅ Reporte completo generado exitosamente');
            console.log(`📑 Total de hojas generadas: ${workbook.worksheets.length}`);

            // Escribir el workbook en la respuesta
            await workbook.xlsx.write(res);
            
            res.end();

        } catch (error) {
            console.error('💥 Error generando reporte completo:', error);
            console.error('Stack trace completo:', error.stack);
            res.status(500).json({
                success: false,
                error: 'Error al generar el reporte completo del sistema: ' + error.message
            });
        }
    }
}

module.exports = new ExcelReportController();