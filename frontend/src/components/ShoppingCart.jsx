import React, { useState, useEffect } from 'react';

const ShoppingCart = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('products'); // products, cart, orders
  const [user, setUser] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Cargar datos iniciales
  useEffect(() => {
    loadUser();
    loadProducts();
    loadCart();
    loadOrders();
  }, []);

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/pagos/productos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  const loadCart = () => {
    try {
      const savedCart = localStorage.getItem('shoppingCart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Error cargando carrito:', error);
    }
  };

  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('shoppingCart', JSON.stringify(newCart));
  };

  const loadOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/pagos/ordenes`, {
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

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    let newCart;

    if (existingItem) {
      newCart = cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...cart, {
        productId: product.id,
        name: product.nombre,
        price: parseFloat(product.precio),
        quantity: 1,
        image: product.imagen_url
      }];
    }

    saveCart(newCart);
    alert(`${product.nombre} agregado al carrito`);
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const newCart = cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: newQuantity }
        : item
    );
    saveCart(newCart);
  };

  const removeFromCart = (productId) => {
    const newCart = cart.filter(item => item.productId !== productId);
    saveCart(newCart);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemsCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const orderItems = cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));

      const response = await fetch(`${API_URL}/pagos/crear-orden`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: orderItems,
          total: getCartTotal()
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Redirigir a PayPal
        window.location.href = data.data.approvalUrl;
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error en checkout:', error);
      alert('Error procesando el pago');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      processing: '#17a2b8',
      completed: '#28a745',
      cancelled: '#dc3545',
      refunded: '#6c757d'
    };
    return colors[status] || '#6c757d';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Pendiente',
      processing: 'Procesando',
      completed: 'Completado',
      cancelled: 'Cancelado',
      refunded: 'Reembolsado'
    };
    return texts[status] || status;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>🛒 Tienda Online</h1>
        {user && (
          <div style={{ fontSize: '14px', color: '#666' }}>
            Bienvenido, {user.nombre}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ marginBottom: '30px' }}>
        <nav style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setCurrentView('products')}
            style={{
              padding: '10px 20px',
              backgroundColor: currentView === 'products' ? '#007bff' : '#f8f9fa',
              color: currentView === 'products' ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🏪 Productos
          </button>
          <button
            onClick={() => setCurrentView('cart')}
            style={{
              padding: '10px 20px',
              backgroundColor: currentView === 'cart' ? '#007bff' : '#f8f9fa',
              color: currentView === 'cart' ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '5px',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            🛒 Carrito
            {cart.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                backgroundColor: '#dc3545',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {getCartItemsCount()}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentView('orders')}
            style={{
              padding: '10px 20px',
              backgroundColor: currentView === 'orders' ? '#007bff' : '#f8f9fa',
              color: currentView === 'orders' ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            📋 Mis Órdenes
          </button>
        </nav>
      </div>

      {/* Products View */}
      {currentView === 'products' && (
        <div>
          <h2>Productos Disponibles</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '20px',
            marginTop: '20px'
          }}>
            {products.map(product => (
              <div key={product.id} style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <img 
                  src={product.imagen_url} 
                  alt={product.nombre}
                  style={{
                    width: '100%',
                    height: '200px',
                    objectFit: 'cover',
                    borderRadius: '5px',
                    marginBottom: '10px'
                  }}
                />
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
                  {product.nombre}
                </h3>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>
                  {product.descripcion}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>
                    {formatPrice(product.precio)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    Stock: {product.stock}
                  </span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#495057'
                  }}>
                    {product.categoria}
                  </span>
                </div>
                <button
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: product.stock > 0 ? '#007bff' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: product.stock > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {product.stock > 0 ? '🛒 Agregar al Carrito' : 'Sin Stock'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cart View */}
      {currentView === 'cart' && (
        <div>
          <h2>Mi Carrito de Compras</h2>
          {cart.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🛒</div>
              <h3>Tu carrito está vacío</h3>
              <p>Agrega algunos productos para comenzar</p>
              <button
                onClick={() => setCurrentView('products')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                Ver Productos
              </button>
            </div>
          ) : (
            <div>
              {/* Cart Items */}
              <div style={{ marginBottom: '20px' }}>
                {cart.map(item => (
                  <div key={item.productId} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '15px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    backgroundColor: 'white'
                  }}>
                    <img 
                      src={item.image} 
                      alt={item.name}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '5px',
                        marginRight: '15px'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 5px 0' }}>{item.name}</h4>
                      <p style={{ margin: '0', color: '#666' }}>
                        {formatPrice(item.price)} cada uno
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        style={{
                          width: '30px',
                          height: '30px',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #ddd',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        -
                      </button>
                      <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        style={{
                          width: '30px',
                          height: '30px',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #ddd',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        +
                      </button>
                      <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 'bold' }}>
                        {formatPrice(item.price * item.quantity)}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        style={{
                          width: '30px',
                          height: '30px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          marginLeft: '10px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Summary */}
              <div style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f8f9fa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ fontSize: '18px' }}>Total de items:</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{getCartItemsCount()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>Total a pagar:</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                    {formatPrice(getCartTotal())}
                  </span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '15px',
                    backgroundColor: loading ? '#6c757d' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  {loading ? '⏳ Procesando...' : '💳 Pagar con PayPal'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orders View */}
      {currentView === 'orders' && (
        <div>
          <h2>Mis Órdenes</h2>
          {orders.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
              <h3>No tienes órdenes aún</h3>
              <p>Realiza tu primera compra</p>
              <button
                onClick={() => setCurrentView('products')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                Ver Productos
              </button>
            </div>
          ) : (
            <div>
              {orders.map(order => (
                <div key={order.id} style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '15px',
                  backgroundColor: 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0' }}>Orden #{order.id}</h4>
                      <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                        {formatDate(order.fecha_creacion)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        padding: '5px 10px',
                        backgroundColor: getStatusColor(order.estado),
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        marginBottom: '5px'
                      }}>
                        {getStatusText(order.estado)}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        {formatPrice(order.total)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Order Items */}
                  {order.items && (
                    <div style={{ marginTop: '15px' }}>
                      <h5 style={{ margin: '0 0 10px 0', color: '#666' }}>Artículos:</h5>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {JSON.parse(typeof order.items === 'string' ? order.items : JSON.stringify(order.items)).map((item, index) => (
                          <div key={index} style={{ marginBottom: '5px' }}>
                            • Producto ID: {item.productId} - Cantidad: {item.quantity}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {order.paypal_capture_id && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                      ID de transacción: {order.paypal_capture_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShoppingCart;