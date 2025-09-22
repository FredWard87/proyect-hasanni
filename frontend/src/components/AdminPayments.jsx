import React, { useState, useEffect } from 'react';

const AdminPayments = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [message, setMessage] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadPendingOrders();
  }, []);

  const loadPendingOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/pagos/admin/ordenes-pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    }
  };

  const verifyPayPalOrder = async (paypalOrderId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/pagos/admin/verificar-orden`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paypalOrderId })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Estado en PayPal: ${data.data.status}`);
      } else {
        alert('Error verificando orden en PayPal');
      }
    } catch (error) {
      console.error('Error verificando orden:', error);
    }
  };

  const capturePayment = async (orderId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/pagos/admin/capturar-orden/${orderId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Pago capturado exitosamente');
        loadPendingOrders();
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      setMessage('Error capturando pago');
    } finally {
      setLoading(false);
    }
  };

  const approveManual = async (orderId) => {
    const notes = prompt('Ingrese notas para esta aprobación manual:');
    if (notes === null) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/pagos/admin/aprobar-manual/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Orden aprobada manualmente');
        loadPendingOrders();
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      setMessage('Error aprobando orden');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🛡️ Panel de Administración - Pagos Pendientes</h1>
      
      {message && (
        <div style={{
          padding: '10px',
          backgroundColor: message.includes('Error') ? '#f8d7da' : '#d4edda',
          color: message.includes('Error') ? '#721c24' : '#155724',
          marginBottom: '20px',
          borderRadius: '5px'
        }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={loadPendingOrders}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          🔄 Actualizar Lista
        </button>
      </div>

      <div style={{
        display: 'grid',
        gap: '15px'
      }}>
        {orders.map(order => (
          <div key={order.id} style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: 'white'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
              <div>
                <h3>Orden #{order.id} - {order.user_name}</h3>
                <p><strong>Email:</strong> {order.user_email}</p>
                <p><strong>Total:</strong> {formatPrice(order.total)}</p>
                <p><strong>Fecha:</strong> {formatDate(order.fecha_creacion)}</p>
                <p><strong>Estado:</strong> 
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: '#ffc107',
                    color: '#000',
                    borderRadius: '12px',
                    fontSize: '12px',
                    marginLeft: '10px'
                  }}>
                    {order.estado}
                  </span>
                </p>
                {order.paypal_order_id && (
                  <p><strong>PayPal ID:</strong> {order.paypal_order_id}</p>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                {order.paypal_order_id && (
                  <>
                    <button
                      onClick={() => verifyPayPalOrder(order.paypal_order_id)}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      🔍 Verificar en PayPal
                    </button>
                    
                    <button
                      onClick={() => capturePayment(order.id)}
                      disabled={loading}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      💳 Capturar Pago
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => approveManual(order.id)}
                  disabled={loading}
                  style={{
                    padding: '8px 15px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✅ Aprobar Manualmente
                </button>
              </div>
            </div>

            <div>
              <h4>Items:</h4>
              {order.items && (
                <div style={{ fontSize: '14px' }}>
                  {JSON.parse(typeof order.items === 'string' ? order.items : JSON.stringify(order.items)).map((item, index) => (
                    <div key={index} style={{ marginBottom: '5px' }}>
                      • Producto ID: {item.productId} - Cantidad: {item.quantity}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {orders.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
          <h3>No hay órdenes pendientes</h3>
          <p>Todas las órdenes han sido procesadas</p>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;