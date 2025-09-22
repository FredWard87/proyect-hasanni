const { query } = require('../config/database');
const fetch = require('node-fetch');

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

// Crear orden de PayPal (SOLO CREA LA ORDEN, NO CAPTURA)
// Crear orden de PayPal (SOLO CREA LA ORDEN, NO CAPTURA)
exports.createPayPalOrder = async (req, res) => {
  try {
    const { items, total } = req.body;
    const userId = req.user.userId;

    // Validar datos
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items son requeridos'
      });
    }

    if (!total || total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total debe ser mayor a 0'
      });
    }

    // Validar productos y calcular total real
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const productResult = await query(
        'SELECT * FROM productos WHERE id = $1 AND activo = true',
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Producto con ID ${item.productId} no encontrado`
        });
      }

      const product = productResult.rows[0];
      const itemTotal = parseFloat(product.precio) * item.quantity;
      calculatedTotal += itemTotal;

      validatedItems.push({
        name: product.nombre,
        unit_amount: {
          currency_code: 'USD',
          value: parseFloat(product.precio).toFixed(2)
        },
        quantity: item.quantity.toString()
      });
    }

    // Verificar que el total coincida (con margen de error de centavos)
    if (Math.abs(calculatedTotal - total) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'El total no coincide con los precios de los productos'
      });
    }

    // CAMBIO IMPORTANTE: Usar 'pending' en lugar de 'pending_payment'
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
          value: calculatedTotal.toFixed(2),
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

// Nueva función: Verificar estado de orden PayPal (para admin)
exports.verifyPayPalOrder = async (req, res) => {
  try {
    const { paypalOrderId } = req.body;

    if (!paypalOrderId) {
      return res.status(400).json({
        success: false,
        message: 'PayPal Order ID es requerido'
      });
    }

    // Obtener token de PayPal
    const accessToken = await getPayPalAccessToken();

    // Verificar orden en PayPal
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}`, {
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

// Nueva función: Capturar pago manualmente (para admin)
exports.capturePayPalOrderManual = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID es requerido'
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
        message: 'Pago procesado correctamente',
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

// Nueva función: Obtener todas las órdenes pendientes (para admin)
// Nueva función: Obtener todas las órdenes pendientes (para admin)
exports.getAllPendingOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

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
      WHERE o.estado = 'pending'  -- CAMBIADO: Solo 'pending'
      ORDER BY o.fecha_creacion DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), offset]);

    const countResult = await query(
      'SELECT COUNT(*) FROM ordenes WHERE estado = $1',
      ['pending']  // CAMBIADO: Solo 'pending'
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
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

// Nueva función: Aprobar orden manualmente (sin PayPal)
exports.approveOrderManual = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID es requerido'
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

    // Actualizar orden como completada manualmente
    await query(`
      UPDATE ordenes 
      SET estado = 'completed', 
          fecha_completado = NOW(),
          admin_notes = $1
      WHERE id = $2
    `, [notes || 'Aprobado manualmente por administrador', order.id]);

    // Crear registro de transacción manual
    await query(`
      INSERT INTO transacciones (orden_id, user_id, monto, estado, metodo_pago)
      VALUES ($1, $2, $3, 'completed', 'manual_approval')
    `, [order.id, order.user_id, order.total]);

    res.json({
      success: true,
      message: 'Orden aprobada manualmente',
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

// Función simplificada para cuando PayPal redirige (solo marca como pendiente)
// Función simplificada para cuando PayPal redirige (solo marca como pendiente)
exports.handlePayPalCallback = async (req, res) => {
  try {
    const { paypalOrderId } = req.body;

    if (!paypalOrderId) {
      return res.status(400).json({
        success: false,
        message: 'PayPal Order ID es requerido'
      });
    }

    // CAMBIO: Ya está como 'pending', no necesitamos cambiarlo
    // Solo verificar que la orden existe
    const orderResult = await query(
      'SELECT id FROM ordenes WHERE paypal_order_id = $1',
      [paypalOrderId]
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
    
    const offset = (parseInt(page) - 1) * parseInt(limit);

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
    `, [userId, parseInt(limit), offset]);

    const countResult = await query(
      'SELECT COUNT(*) FROM ordenes WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
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