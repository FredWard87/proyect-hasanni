import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Usuarios from './components/Usuario';
import Loginsito from './components/Auth/Login';
import Register from './components/Auth/Registro';
import ForgotPassword from './components/Auth/Recuperar';
import ResetPassword from './components/Auth/Resetear';
import LocationManager from './components/Ubicacion';
import Shoppi from './components/ShoppingCart';
import AdminPayments from './components/AdminPayments';


// AGREGAR ESTOS IMPORTS:
import { PaymentSuccess, PaymentCancel } from './components/paypal';

import './App.css';

// Componente para capturar el token de Google y redirigir
function TokenHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.history.replaceState({}, document.title, '/Usuarios');
      navigate('/Usuarios');
    }
  }, [navigate]);
  return null;
}

function App() {
  return (
    <div className="App">
      <Router>
        <TokenHandler />
        <Routes>
          <Route path="/Usuarios" element={<Usuarios />} />
          <Route path="/" element={<Loginsito />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/locations" element={<LocationManager />} />
          <Route path="/shop" element={<Shoppi />} />
          
          {/* AGREGAR ESTAS RUTAS PARA PAYPAL: */}
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/admin/pagos" element={<AdminPayments />} />

        </Routes>
      </Router>
    </div>
  );
}

export default App;