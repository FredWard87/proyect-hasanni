// controllers/excelReportController.js - CON VALIDACIONES COMPLETAS
const excelReportService = require('../services/excelReportService');
const ExcelJS = require('exceljs');

// Función auxiliar para validar fechas
function validateDateFormat(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return { valid: false, error: 'La fecha debe ser un texto' };
    }

    const trimmedDate = dateString.trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(trimmedDate)) {
        return { valid: false, error: 'El formato de fecha debe ser YYYY-MM-DD (ejemplo: 2025-12-20)' };
    }

    const [year, month, day] = trimmedDate.split('-').map(Number);

    // Validar rangos de mes y día
    if (month < 1 || month > 12) {
        return { valid: false, error: 'El mes debe estar entre 01 y 12' };
    }

    if (day < 1 || day > 31) {
        return { valid: false, error: 'El día debe estar entre 01 y 31' };
    }

    // Crear fecha para validar que sea una fecha válida
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
        return { valid: false, error: 'La fecha no es válida (verifica los días del mes)' };
    }

    // Validar que no sea una fecha futura (opcional pero recomendado para reportes)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj > today) {
        return { valid: false, error: 'La fecha no puede ser futura' };
    }

    return { valid: true, dateObj };
}

// Función auxiliar para comparar fechas
function compareDates(startDate, endDate) {
    if (startDate > endDate) {
        return { valid: false, error: 'La fecha de inicio no puede ser mayor a la fecha de fin' };
    }
    return { valid: true };
}

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
            const { incluir_stock_bajo, incluir_metricas } = req.query;
            const errors = [];

            // Validar tipos de datos
            if (incluir_stock_bajo !== undefined && typeof incluir_stock_bajo !== 'string') {
                errors.push('El parámetro "incluir_stock_bajo" debe ser "true" o "false"');
            }

            if (incluir_metricas !== undefined && typeof incluir_metricas !== 'string') {
                errors.push('El parámetro "incluir_metricas" debe ser "true" o "false"');
            }

            // Validar valores
            const validBoolValues = ['true', 'false'];
            if (incluir_stock_bajo && !validBoolValues.includes(incluir_stock_bajo.toLowerCase())) {
                errors.push('El valor de "incluir_stock_bajo" debe ser "true" o "false"');
            }

            if (incluir_metricas && !validBoolValues.includes(incluir_metricas.toLowerCase())) {
                errors.push('El valor de "incluir_metricas" debe ser "true" o "false"');
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Error de validación',
                    errors: errors
                });
            }

            const workbook = await excelReportService.generateInventoryReport(
                incluir_stock_bajo !== 'false',
                incluir_metricas !== 'false'
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

    // Generar reporte de movimientos en Excel - CON VALIDACIONES DE FECHA
    async generateMovementsReport(req, res) {
        try {
            const { fecha_inicio, fecha_fin } = req.query;
            const errors = [];

            // Validar que las fechas sean proporcionadas
            if (!fecha_inicio) {
                errors.push('La fecha de inicio es requerida (formato: YYYY-MM-DD)');
            }

            if (!fecha_fin) {
                errors.push('La fecha de fin es requerida (formato: YYYY-MM-DD)');
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Error de validación',
                    errors: errors
                });
            }

            // Validar formato de fecha de inicio
            const startDateValidation = validateDateFormat(fecha_inicio);
            if (!startDateValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Error en la fecha de inicio',
                    error: startDateValidation.error
                });
            }

            // Validar formato de fecha de fin
            const endDateValidation = validateDateFormat(fecha_fin);
            if (!endDateValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Error en la fecha de fin',
                    error: endDateValidation.error
                });
            }

            // Validar que fecha_inicio no sea mayor que fecha_fin
            const dateComparison = compareDates(startDateValidation.dateObj, endDateValidation.dateObj);
            if (!dateComparison.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Error en el rango de fechas',
                    error: dateComparison.error
                });
            }

            // Validar que el rango no sea mayor a 2 años (86400000 ms * 730 días aprox)
            const maxRangeMs = 86400000 * 730;
            const rangeMs = endDateValidation.dateObj - startDateValidation.dateObj;
            if (rangeMs > maxRangeMs) {
                return res.status(400).json({
                    success: false,
                    message: 'Error en el rango de fechas',
                    error: 'El rango de fechas no puede ser mayor a 2 años'
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

    // Generar reporte de productos más movidos en Excel - CON VALIDACIONES
    async generateTopProductsReport(req, res) {
        try {
            const { dias = 30, limite = 10 } = req.query;
            const errors = [];

            // Validar tipos de datos
            if (dias !== undefined && isNaN(dias)) {
                errors.push('El parámetro "dias" debe ser un número');
            }

            if (limite !== undefined && isNaN(limite)) {
                errors.push('El parámetro "limite" debe ser un número');
            }

            // Convertir y validar rangos
            const diasNum = parseInt(dias);
            const limiteNum = parseInt(limite);

            if (diasNum < 1) {
                errors.push('El número de días debe ser mayor a 0');
            }

            if (diasNum > 365) {
                errors.push('El número de días no puede exceder 365');
            }

            if (limiteNum < 1) {
                errors.push('El límite debe ser mayor a 0');
            }

            if (limiteNum > 100) {
                errors.push('El límite no puede exceder 100 productos');
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Error de validación',
                    errors: errors
                });
            }

            const workbook = await excelReportService.generateTopProductsReport(diasNum, limiteNum);

            // Configurar headers para descarga
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_productos_movidos_${diasNum}dias.xlsx"`);

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

    // Generar reporte completo del sistema - CON VALIDACIONES
    async generateFullSystemReport(req, res) {
        try {
            const { fecha_inicio, fecha_fin, dias = 30 } = req.query;
            const errors = [];

            // Validar días si se proporciona
            if (dias !== undefined && isNaN(dias)) {
                errors.push('El parámetro "dias" debe ser un número');
            }

            const diasNum = parseInt(dias);
            if (diasNum < 1) {
                errors.push('El número de días debe ser mayor a 0');
            }

            if (diasNum > 365) {
                errors.push('El número de días no puede exceder 365');
            }

            // Si se proporcionan fechas, validarlas
            let startDate = null;
            let endDate = null;

            if (fecha_inicio || fecha_fin) {
                if (!fecha_inicio) {
                    errors.push('Si proporciona "fecha_fin", también debe proporcionar "fecha_inicio"');
                }

                if (!fecha_fin) {
                    errors.push('Si proporciona "fecha_inicio", también debe proporcionar "fecha_fin"');
                }

                if (fecha_inicio) {
                    const startValidation = validateDateFormat(fecha_inicio);
                    if (!startValidation.valid) {
                        errors.push(`Error en fecha_inicio: ${startValidation.error}`);
                    } else {
                        startDate = startValidation.dateObj;
                    }
                }

                if (fecha_fin) {
                    const endValidation = validateDateFormat(fecha_fin);
                    if (!endValidation.valid) {
                        errors.push(`Error en fecha_fin: ${endValidation.error}`);
                    } else {
                        endDate = endValidation.dateObj;
                    }
                }

                // Comparar fechas si ambas son válidas
                if (startDate && endDate) {
                    const dateComparison = compareDates(startDate, endDate);
                    if (!dateComparison.valid) {
                        errors.push(dateComparison.error);
                    }

                    // Validar rango máximo
                    const maxRangeMs = 86400000 * 730;
                    const rangeMs = endDate - startDate;
                    if (rangeMs > maxRangeMs) {
                        errors.push('El rango de fechas no puede ser mayor a 2 años');
                    }
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Error de validación',
                    errors: errors
                });
            }

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
            
            if (startDate && endDate) {
                infoSheet.addRow([`- Movimientos del ${fecha_inicio} al ${fecha_fin}`]);
            } else {
                infoSheet.addRow(['- Movimientos (últimos 30 días)']);
            }
            
            infoSheet.addRow([`- Productos más movidos (últimos ${diasNum} días)`]);

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
                const topProductsWorkbook = await excelReportService.generateTopProductsReport(diasNum, 15);
                
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