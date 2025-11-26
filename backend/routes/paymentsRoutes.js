const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const adminMiddleware = require('../middlewares/adminMiddleware'); 

// Aplicar middleware de autenticación a todas las rutas

// Rutas de productos
router.get('/productos', paymentsController.getProducts); 

// Rutas de órdenes y pagos (usuarios normales)
router.post('/crear-orden', paymentsController.createPayPalOrder);
router.post('/callback-paypal', paymentsController.handlePayPalCallback); 
router.get('/ordenes', paymentsController.getUserOrders);
router.get('/ordenes/:orderId', paymentsController.getOrderDetails);
// En tu routes file, agrega:
router.get('/debug-config', paymentsController.debugConfig);


// Rutas de administración (requieren ser admin)
router.get('/admin/ordenes-pendientes', adminMiddleware, paymentsController.getAllPendingOrders);
router.post('/admin/verificar-orden', adminMiddleware, paymentsController.verifyPayPalOrder);
router.post('/admin/capturar-orden/:orderId', adminMiddleware, paymentsController.capturePayPalOrderManual);
router.post('/admin/aprobar-manual/:orderId', adminMiddleware, paymentsController.approveOrderManual);

module.exports = router;
