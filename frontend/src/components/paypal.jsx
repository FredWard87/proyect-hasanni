import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PaymentCallback = ({ type }) => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (type === 'success') {
      handlePaymentSuccess();
    } else if (type === 'cancel') {
      handlePaymentCancel();
    }
  }, [type]);

  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      token: params.get('token')
    };
  };

  const handlePaymentSuccess = async () => {
    try {
      const { token: paypalOrderId } = getUrlParams();

      if (!paypalOrderId) {
        setMessage('Error: No se encontró el ID de la orden de PayPal');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      
      // Solo notificar al backend que recibimos el callback
      const response = await fetch(`${API_URL}/pagos/callback-paypal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paypalOrderId: paypalOrderId
        })
      });

      if (response.ok) {
        setSuccess(true);
        setMessage('¡Pago recibido! Un administrador procesará tu orden pronto. Gracias por tu compra.');
        
        // Limpiar carrito
        localStorage.removeItem('shoppingCart');
      } else {
        setMessage('Pago recibido. Tu orden será procesada pronto.');
        setSuccess(true);
      }
      
    } catch (error) {
      // Si hay error, igual mostramos mensaje de éxito
      setMessage('Pago recibido. Tu orden será procesada por un administrador.');
      setSuccess(true);
      localStorage.removeItem('shoppingCart');
    } finally {
      setLoading(false);
      
      // Redirigir después de 5 segundos
      setTimeout(() => {
        navigate('/shop');
      }, 5000);
    }
  };

  const handlePaymentCancel = () => {
    setLoading(false);
    setSuccess(false);
    setMessage('El pago fue cancelado. Puedes intentarlo nuevamente.');
    
    setTimeout(() => {
      navigate('/shop');
    }, 3000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '40px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {loading ? (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h2>Procesando...</h2>
          </div>
        ) : (
          <div>
            <div style={{ 
              fontSize: '64px', 
              marginBottom: '20px',
              color: success ? '#28a745' : '#ffc107'
            }}>
              {success ? '✅' : '⚠️'}
            </div>
            
            <h2 style={{
              color: success ? '#28a745' : '#856404',
              marginBottom: '15px'
            }}>
              {success ? '¡Gracias por tu compra!' : 'Pago Cancelado'}
            </h2>
            
            <p style={{ 
              color: '#666', 
              fontSize: '16px', 
              lineHeight: '1.5',
              marginBottom: '30px'
            }}>
              {message}
            </p>

            <button
              onClick={() => navigate('/shop')}
              style={{
                padding: '12px 30px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Volver a la Tienda
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const PaymentSuccess = () => <PaymentCallback type="success" />;
export const PaymentCancel = () => <PaymentCallback type="cancel" />;

export default PaymentCallback;