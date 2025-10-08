// routes/inventoryRoutes.js
const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Rutas de inventario
router.get('/', inventoryController.getInventory);
router.get('/low-stock', inventoryController.getLowStock);
router.get('/dashboard', inventoryController.getDashboard);
router.get('/movements', inventoryController.getMovements);
router.get('/usuarios-movimientos', inventoryController.getUsuariosParaMovimientos);
router.get('/proveedores', inventoryController.getProveedores);
router.post('/products', inventoryController.createProduct);
router.post('/entries', inventoryController.registerEntry);
router.post('/exits', inventoryController.registerExit);
router.post('/proveedores', inventoryController.createProveedor);
router.put('/products/:id', inventoryController.updateProduct);
router.delete('/products/:id', inventoryController.deleteProduct);
router.put('/proveedores/:id', inventoryController.updateProveedor);

module.exports = router;