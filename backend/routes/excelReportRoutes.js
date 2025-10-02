// routes/excelReportRoutes.js
const express = require('express');
const router = express.Router();
const excelReportController = require('../controllers/excelReportController');

// Reportes en Excel
router.get('/inventario', excelReportController.generateInventoryReport);
router.get('/movimientos', excelReportController.generateMovementsReport);
router.get('/productos-movidos', excelReportController.generateTopProductsReport);
router.get('/completo', excelReportController.generateFullSystemReport);

module.exports = router;