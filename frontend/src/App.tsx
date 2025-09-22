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
import PreferentUserMode from './components/preferentuser';
import Campanita from './components/NotificationBell.js'

// AGREGAR ESTOS IMPORTS:
import { PaymentSuccess, PaymentCancel } from './components/paypal';

// IMPORTAR EL PROVIDER DE PREFERENCIAS Y BIOMÉTRICO
import { PreferencesProvider } from './components/PreferencesContext';
import { BiometricProvider } from './components/BiometricContext';

// IMPORTAR COMPONENTES BIOMÉTRICOS
import BiometricGuard from './components/BiometricGuard';

import './App.css';

// Componente para capturar el token de Google y redirigir
function TokenHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      
      // Verificar si requiere setup biométrico
      setTimeout(() => {
        navigate('/Usuarios');
      }, 100);
    }
  }, [navigate]);
  return null;
}

function App() {
  return (
    <div className="App">
      {/* ENVOLVER TODO CON LOS PROVIDERS */}
      <PreferencesProvider>
        <BiometricProvider>
          <Router>
            <TokenHandler />
            <Routes>
              {/* Proteger rutas con guardia biométrica */}
              <Route path="/Usuarios" element={
                <BiometricGuard>
                  <Usuarios />
                </BiometricGuard>
              } />
              <Route path="/locations" element={
                <BiometricGuard>
                  <LocationManager />
                </BiometricGuard>
              } />
              <Route path="/shop" element={
                <BiometricGuard>
                  <Shoppi />
                </BiometricGuard>
              } />
              <Route path="/preferentuser" element={
                <BiometricGuard>
                  <PreferentUserMode />
                </BiometricGuard>
              } />
              <Route path="/admin/pagos" element={
                <BiometricGuard>
                  <AdminPayments />
                </BiometricGuard>
              } />
              
              {/* Rutas públicas */}
              <Route path="/" element={<Loginsito />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/notifications" element={<Campanita />} />
              
              {/* AGREGAR ESTAS RUTAS PARA PAYPAL: */}
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel" element={<PaymentCancel />} />
            </Routes>
          </Router>
        </BiometricProvider>
      </PreferencesProvider>
    </div>
  );
}

export default App;