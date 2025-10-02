// routes/supplierRoutes.js (se mantiene igual)
const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/SuppliersController')

router.get('/', suppliersController.getSuppliers);
router.post('/', suppliersController.createSupplier);
router.put('/:id', suppliersController.updateSupplier);

module.exports = router;