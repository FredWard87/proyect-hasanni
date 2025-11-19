// controllers/paymentController.js
// controllers/paymentController.js
const { query } = require('../config/database');
const fetch = require('node-fetch');
const { Resend } = require('resend');

// Configuración de PayPal
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Obtener access token de PayPal
const getPayPalAccessToken = async () => {
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error obteniendo token de PayPal:', error);
    throw error;
  }
};

// Función para redondear a 2 decimales
const roundToTwoDecimals = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Función para verificar y enviar alertas de stock bajo
const checkAndSendLowStockAlerts = async (items) => {
  try {
    const lowStockProducts = [];
    
    for (const item of items) {
      // Verificar si después de la venta el stock queda en o por debajo del mínimo
      const productResult = await query(`
        SELECT p.id, p.nombre, p.stock, p.stock_minimo, p.codigo
        FROM productos p 
        WHERE p.id = $1 AND p.activo = true
      `, [item.productId]);

      if (productResult.rows.length > 0) {
        const product = productResult.rows[0];
        const newStock = product.stock - item.quantity;
        
        // Si el stock después de la venta es menor o igual al stock mínimo
        if (newStock <= product.stock_minimo) {
          lowStockProducts.push({
            id: product.id,
            nombre: product.nombre,
            codigo: product.codigo,
            stock_actual: newStock,
            stock_minimo: product.stock_minimo,
            cantidad_vendida: item.quantity
          });
        }
      }
    }

    // Si hay productos con stock bajo, enviar alerta
    if (lowStockProducts.length > 0) {
      await sendLowStockAlert(lowStockProducts);
    }
    
    return lowStockProducts;
  } catch (error) {
    console.error('Error verificando stock bajo:', error);
    // No lanzar error para no interrumpir el proceso de pago
  }
};

// Función para enviar alerta de stock bajo por email
const sendLowStockAlert = async (lowStockProducts) => {
  try {
    // Obtener email del administrador
    const adminResult = await query(`
      SELECT email FROM usuarios WHERE rol = 'admin' AND activo = true LIMIT 1
    `);
    
    if (adminResult.rows.length === 0) {
      console.log('No se encontró administrador para enviar alerta');
      return;
    }

    const adminEmail = adminResult.rows[0].email;
    
    // Crear contenido del email
    const emailSubject = `🚨 Alerta: Productos con Stock Bajo - ${new Date().toLocaleDateString()}`;
    
    let emailContent = `
      <h2>Alerta de Stock Bajo</h2>
      <p>Los siguientes productos han alcanzado o están por debajo de su stock mínimo después de una venta:</p>
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px; text-align: left;">Código</th>
            <th style="padding: 8px; text-align: left;">Producto</th>
            <th style="padding: 8px; text-align: left;">Stock Actual</th>
            <th style="padding: 8px; text-align: left;">Stock Mínimo</th>
            <th style="padding: 8px; text-align: left;">Cantidad Vendida</th>
            <th style="padding: 8px; text-align: left;">Estado</th>
          </tr>
        </thead>
        <tbody>
    `;

    lowStockProducts.forEach(product => {
      const estado = product.stock_actual < product.stock_minimo ? 'CRÍTICO' : 'ALERTA';
      const color = product.stock_actual < product.stock_minimo ? '#ffcccc' : '#fff3cd';
      
      emailContent += `
        <tr style="background-color: ${color};">
          <td style="padding: 8px;">${product.codigo}</td>
          <td style="padding: 8px;">${product.nombre}</td>
          <td style="padding: 8px; text-align: center;">${product.stock_actual}</td>
          <td style="padding: 8px; text-align: center;">${product.stock_minimo}</td>
          <td style="padding: 8px; text-align: center;">${product.cantidad_vendida}</td>
          <td style="padding: 8px; text-align: center; font-weight: bold;">${estado}</td>
        </tr>
      `;
    });

    emailContent += `
        </tbody>
      </table>
      <br>
      <p><strong>Acción requerida:</strong> Por favor, realice un pedido de estos productos para reponer el stock.</p>
      <p>Fecha de la alerta: ${new Date().toLocaleString()}</p>
    `;

    // Enviar email (usando el mismo sistema de email que tienes configurado)
    
   const resend = new Resend(process.env.RESEND_API_KEY);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: emailSubject,
      html: emailContent
    });

    console.log(`Alerta de stock bajo enviada a ${adminEmail} para ${lowStockProducts.length} productos`);
    
    // También registrar la alerta en la base de datos
    for (const product of lowStockProducts) {
      await query(`
        INSERT INTO alertas_stock 
        (id_producto, codigo_producto, nombre_producto, stock_actual, stock_minimo, tipo_alerta, enviada)
        VALUES ($1, $2, $3, $4, $5, $6, true)
      `, [
        product.id,
        product.codigo,
        product.nombre,
        product.stock_actual,
        product.stock_minimo,
        product.stock_actual < product.stock_minimo ? 'critico' : 'alerta'
      ]);
    }

  } catch (error) {
    console.error('Error enviando alerta de stock bajo:', error);
  }
};

// Obtener productos disponibles
exports.getProducts = async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM productos 
      WHERE activo = true 
      ORDER BY categoria, nombre
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear orden de PayPal - MEJORADO CON REDONDEO
exports.createPayPalOrder = async (req, res) => {
  try {
    const { items } = req.body;
    const userId = req.user.userId;

    // Validar datos
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items son requeridos',
        errors: ['Debe proporcionar al menos un producto']
      });
    }

    const errors = [];

    // Validar cada item
    for (const item of items) {
      if (!item.productId) {
        errors.push('El ID del producto es requerido para cada item');
      }
      if (!item.quantity || isNaN(item.quantity)) {
        errors.push('La cantidad debe ser un número válido');
      }
      if (item.quantity < 1) {
        errors.push('La cantidad debe ser mayor a 0');
      }
      if (item.quantity > 999999) {
        errors.push('La cantidad no puede exceder 999999');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors
      });
    }

    // Validar productos y calcular total automáticamente CON REDONDEO
    let calculatedTotal = 0;
    const validatedItems = [];
    const productsForInventory = [];

    for (const item of items) {
      const productResult = await query(
        'SELECT id, nombre, precio, stock FROM productos WHERE id = $1 AND activo = true',
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Producto con ID ${item.productId} no encontrado o no está disponible`
        });
      }

      const product = productResult.rows[0];
      const quantity = parseInt(item.quantity);

      // Validar stock disponible
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock}, Solicitado: ${quantity}`
        });
      }

      const itemTotal = parseFloat(product.precio) * quantity;
      calculatedTotal += itemTotal;

      validatedItems.push({
        name: product.nombre,
        unit_amount: {
          currency_code: 'USD',
          value: roundToTwoDecimals(parseFloat(product.precio)).toFixed(2)
        },
        quantity: quantity.toString()
      });

      productsForInventory.push({
        productId: product.id,
        quantity: quantity
      });
    }

    // REDONDEO CORREGIDO: Redondear el total a 2 decimales
    calculatedTotal = roundToTwoDecimals(calculatedTotal);

    if (calculatedTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El total debe ser mayor a 0'
      });
    }

    // Crear orden en base de datos con estado 'pending'
    const orderResult = await query(`
      INSERT INTO ordenes (user_id, total, estado, items)
      VALUES ($1, $2, 'pending', $3)
      RETURNING id, total, estado, fecha_creacion
    `, [userId, calculatedTotal, JSON.stringify(items)]);

    const order = orderResult.rows[0];

    // Obtener token de PayPal
    const accessToken = await getPayPalAccessToken();

    // Crear orden en PayPal
    const paypalOrder = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.id.toString(),
        amount: {
          currency_code: 'USD',
          value: calculatedTotal.toFixed(2), // Ya está redondeado
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: calculatedTotal.toFixed(2)
            }
          }
        },
        items: validatedItems
      }],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        brand_name: 'Tu Empresa',
        locale: 'es-ES',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW'
      }
    };

    const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paypalOrder)
    });

    const paypalData = await paypalResponse.json();

    if (!paypalResponse.ok) {
      console.error('Error creando orden PayPal:', paypalData);
      return res.status(400).json({
        success: false,
        message: 'Error creando orden de pago',
        error: paypalData
      });
    }

    // Actualizar orden con PayPal ID
    await query(
      'UPDATE ordenes SET paypal_order_id = $1 WHERE id = $2',
      [paypalData.id, order.id]
    );

    res.json({
      success: true,
      data: {
        orderId: order.id,
        paypalOrderId: paypalData.id,
        approvalUrl: paypalData.links.find(link => link.rel === 'approve').href,
        total: calculatedTotal
      }
    });

  } catch (error) {
    console.error('Error creando orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función auxiliar para restar stock CON VERIFICACIÓN DE ALERTAS
const decreaseInventoryStock = async (items) => {
  try {
    for (const item of items) {
      await query(`
        UPDATE productos 
        SET stock = stock - $1 
        WHERE id = $2 AND stock >= $1
      `, [item.quantity || item.productId ? 1 : 0, item.productId]);

      // Registrar movimiento de salida
      await query(`
        INSERT INTO movimientos_inventario 
        (tipo, id_producto, cantidad, referencia, documento, responsable, observaciones)
        VALUES ('salida', $1, $2, $3, $4, 'Sistema', 'Venta por PayPal')
      `, [item.productId, item.quantity, `PAY-${Date.now()}`, `PAGO-${Date.now()}`]);
    }

    // VERIFICAR Y ENVIAR ALERTAS DE STOCK BAJO
    await checkAndSendLowStockAlerts(items);
  } catch (error) {
    console.error('Error actualizando stock:', error);
    throw error;
  }
};

// Verificar estado de orden PayPal (para admin)
exports.verifyPayPalOrder = async (req, res) => {
  try {
    const { paypalOrderId } = req.body;
    const errors = [];

    if (!paypalOrderId) {
      errors.push('PayPal Order ID es requerido');
    }

    if (typeof paypalOrderId !== 'string' || paypalOrderId.trim() === '') {
      errors.push('PayPal Order ID debe ser un texto válido');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors
      });
    }

    // Obtener token de PayPal
    const accessToken = await getPayPalAccessToken();

    // Verificar orden en PayPal
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId.trim()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const paypalData = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: 'Error verificando orden en PayPal',
        error: paypalData
      });
    }

    res.json({
      success: true,
      data: {
        status: paypalData.status,
        paypalOrderId: paypalData.id,
        amount: paypalData.purchase_units[0]?.amount?.value,
        createTime: paypalData.create_time,
        updateTime: paypalData.update_time
      }
    });

  } catch (error) {
    console.error('Error verificando orden PayPal:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Capturar pago manualmente (para admin) - CON DESCUENTO DE STOCK Y ALERTAS
exports.capturePayPalOrderManual = async (req, res) => {
  try {
    const { orderId } = req.params;
    const errors = [];

    if (!orderId || isNaN(orderId)) {
      errors.push('Order ID debe ser un número válido');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors
      });
    }

    // Buscar orden en base de datos
    const orderResult = await query(
      'SELECT * FROM ordenes WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    const order = orderResult.rows[0];

    if (!order.paypal_order_id) {
      return res.status(400).json({
        success: false,
        message: 'La orden no tiene ID de PayPal asociado'
      });
    }

    if (order.estado === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Esta orden ya ha sido completada previamente'
      });
    }

    // Obtener token de PayPal
    const accessToken = await getPayPalAccessToken();

    // Capturar pago en PayPal
    const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${order.paypal_order_id}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      console.error('Error capturando pago PayPal:', captureData);
      return res.status(400).json({
        success: false,
        message: 'Error procesando el pago en PayPal',
        error: captureData
      });
    }

    // Verificar estado del pago
    if (captureData.status === 'COMPLETED') {
      const captureId = captureData.purchase_units[0].payments.captures[0].id;
      
      // Parsear items
      let items = [];
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      } catch (e) {
        console.error('Error parseando items:', e);
      }

      // Restar stock del inventario Y VERIFICAR ALERTAS
      await decreaseInventoryStock(items);

      // Actualizar orden como completada
      await query(`
        UPDATE ordenes 
        SET estado = 'completed', 
            paypal_capture_id = $1, 
            fecha_completado = NOW()
        WHERE id = $2
      `, [captureId, order.id]);

      // Crear registro de transacción
      await query(`
        INSERT INTO transacciones (orden_id, user_id, paypal_capture_id, monto, estado)
        VALUES ($1, $2, $3, $4, 'completed')
      `, [order.id, order.user_id, captureId, order.total]);

      res.json({
        success: true,
        message: 'Pago procesado correctamente y stock actualizado',
        data: {
          orderId: order.id,
          transactionId: captureId,
          status: 'completed',
          amount: order.total
        }
      });
    } else {
      // Pago no completado
      await query(
        'UPDATE ordenes SET estado = $1 WHERE id = $2',
        [captureData.status.toLowerCase(), order.id]
      );

      res.status(400).json({
        success: false,
        message: 'Pago no completado en PayPal',
        data: {
          status: captureData.status,
          orderId: order.id
        }
      });
    }

  } catch (error) {
    console.error('Error capturando pago manual:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener todas las órdenes pendientes (para admin)
exports.getAllPendingOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const errors = [];

    if (isNaN(page) || page < 1) {
      errors.push('El número de página debe ser mayor a 0');
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push('El límite debe estar entre 1 y 100');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const result = await query(`
      SELECT 
        o.*,
        u.nombre as user_name,
        u.email as user_email,
        t.paypal_capture_id,
        t.estado as transaction_status
      FROM ordenes o
      LEFT JOIN usuarios u ON o.user_id = u.id
      LEFT JOIN transacciones t ON o.id = t.orden_id
      WHERE o.estado = 'pending'
      ORDER BY o.fecha_creacion DESC
      LIMIT $1 OFFSET $2
    `, [limitNum, offset]);

    const countResult = await query(
      'SELECT COUNT(*) FROM ordenes WHERE estado = $1',
      ['pending']
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum)
      }
    });

  } catch (error) {
    console.error('Error obteniendo órdenes pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Aprobar orden manualmente (sin PayPal) - CON DESCUENTO DE STOCK Y ALERTAS
exports.approveOrderManual = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;
    const errors = [];

    if (!orderId || isNaN(orderId)) {
      errors.push('Order ID debe ser un número válido');
    }

    if (notes && typeof notes !== 'string') {
      errors.push('Las notas deben ser texto');
    }

    if (notes && notes.trim().length > 500) {
      errors.push('Las notas no pueden exceder 500 caracteres');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors
      });
    }

    // Buscar orden en base de datos
    const orderResult = await query(
      'SELECT * FROM ordenes WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    const order = orderResult.rows[0];

    if (order.estado === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Esta orden ya ha sido completada previamente'
      });
    }

    // Parsear items
    let items = [];
    try {
      items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch (e) {
      console.error('Error parseando items:', e);
    }

    // Restar stock del inventario Y VERIFICAR ALERTAS
    await decreaseInventoryStock(items);

    // Actualizar orden como completada manualmente
    await query(`
      UPDATE ordenes 
      SET estado = 'completed', 
          fecha_completado = NOW(),
          admin_notes = $1
      WHERE id = $2
    `, [notes?.trim() || 'Aprobado manualmente por administrador', order.id]);

    // Crear registro de transacción manual
    await query(`
      INSERT INTO transacciones (orden_id, user_id, monto, estado, metodo_pago)
      VALUES ($1, $2, $3, 'completed', 'manual_approval')
    `, [order.id, order.user_id, order.total]);

    res.json({
      success: true,
      message: 'Orden aprobada manualmente y stock actualizado',
      data: {
        orderId: order.id,
        status: 'completed',
        amount: order.total
      }
    });

  } catch (error) {
    console.error('Error aprobando orden manual:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Callback de PayPal
exports.handlePayPalCallback = async (req, res) => {
  try {
    const { paypalOrderId } = req.body;
    const errors = [];

    if (!paypalOrderId) {
      errors.push('PayPal Order ID es requerido');
    }

    if (typeof paypalOrderId !== 'string' || paypalOrderId.trim() === '') {
      errors.push('PayPal Order ID debe ser un texto válido');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors
      });
    }

    // Verificar que la orden existe
    const orderResult = await query(
      'SELECT id FROM ordenes WHERE paypal_order_id = $1',
      [paypalOrderId.trim()]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Orden recibida, será procesada por un administrador',
      orderId: orderResult.rows[0].id
    });

  } catch (error) {
    console.error('Error en callback de PayPal:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener historial de órdenes del usuario
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;
    const errors = [];

    if (isNaN(page) || page < 1) {
      errors.push('El número de página debe ser mayor a 0');
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push('El límite debe estar entre 1 y 100');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const result = await query(`
      SELECT 
        o.*,
        t.paypal_capture_id,
        t.estado as transaction_status
      FROM ordenes o
      LEFT JOIN transacciones t ON o.id = t.orden_id
      WHERE o.user_id = $1
      ORDER BY o.fecha_creacion DESC
      LIMIT $2 OFFSET $3
    `, [userId, limitNum, offset]);

    const countResult = await query(
      'SELECT COUNT(*) FROM ordenes WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum)
      }
    });

  } catch (error) {
    console.error('Error obteniendo órdenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener detalles de una orden específica
exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Order ID debe ser un número válido'
      });
    }

    const result = await query(`
      SELECT 
        o.*,
        t.paypal_capture_id,
        t.estado as transaction_status,
        u.nombre as user_name,
        u.email as user_email
      FROM ordenes o
      LEFT JOIN transacciones t ON o.id = t.orden_id
      LEFT JOIN usuarios u ON o.user_id = u.id
      WHERE o.id = $1 AND o.user_id = $2
    `, [orderId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    const order = result.rows[0];
    
    // Parsear items si es string JSON
    if (typeof order.items === 'string') {
      try {
        order.items = JSON.parse(order.items);
      } catch (e) {
        console.error('Error parseando items:', e);
      }
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error obteniendo detalles de orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Endpoint para obtener alertas de stock (para admin)
exports.getStockAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 20, tipo } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    
    if (tipo) {
      queryParams.push(tipo);
      whereClause += ` AND tipo_alerta = $${queryParams.length}`;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    queryParams.push(limitNum, offset);

    const result = await query(`
      SELECT * FROM alertas_stock 
      ${whereClause}
      ORDER BY fecha_alerta DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    const countResult = await query(`
      SELECT COUNT(*) FROM alertas_stock 
      ${whereClause}
    `, tipo ? [tipo] : []);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum)
      }
    });

  } catch (error) {
    console.error('Error obteniendo alertas de stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};