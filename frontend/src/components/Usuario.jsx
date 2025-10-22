import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  AlertTitle,
  Collapse,
  Fade,
  CircularProgress,
  Backdrop,
  Tooltip,
  Avatar,
  Divider,
  Stack,
  Fab,
  AppBar,
  Toolbar,
  Badge,
  Menu,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Edit as EditorIcon,
  Visibility as ReaderIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  Logout as LogoutIcon,
  Lock as LockIcon,
  Payment as PaymentIcon,
  Notifications as NotificationsIcon,
  Check as CheckIcon,
  Security as SecurityIcon,
  SystemUpdate as SystemUpdateIcon,
  Refresh as RefreshIcon,
  VpnKey as KeyIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import axios from 'axios';
import Grid from '@mui/material/Grid';
import { LocationOn } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Sistema de permisos por rol
const PERMISOS = {
  lector: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false
  },
  editor: {
    ver: true,
    crear: true,
    editar: true,
    eliminar: false
  },
  admin: {
    ver: true,
    crear: true,
    editar: true,
    eliminar: true
  }
};

// Componente de campanita de notificaciones REAL
const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);

  const open = Boolean(anchorEl);

  // Cargar notificaciones REALES del backend
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const notifs = response.data.notifications || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.leida).length);
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_URL}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, leida: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marcando como leída:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_URL}/notifications/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prev => prev.map(notif => ({ ...notif, leida: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    }
  };

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
    await loadNotifications();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRefresh = async () => {
    await loadNotifications();
  };

  const getNotificationIcon = (tipo) => {
    switch (tipo) {
      case 'seguridad':
        return <SecurityIcon color="error" fontSize="small" />;
      case 'admin':
        return <AdminIcon color="primary" fontSize="small" />;
      case 'sistema':
        return <SystemUpdateIcon color="info" fontSize="small" />;
      default:
        return <NotificationsIcon color="action" fontSize="small" />;
    }
  };

  const getPriorityColor = (prioridad) => {
    switch (prioridad) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ position: 'relative' }}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 400, maxWidth: '90vw', maxHeight: '70vh', mt: 1 }
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              Notificaciones
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" onClick={handleRefresh} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
              {unreadCount > 0 && (
                <Button 
                  size="small" 
                  onClick={markAllAsRead}
                  startIcon={<CheckIcon />}
                  disabled={loading}
                >
                  Marcar todas
                </Button>
              )}
            </Box>
          </Box>
          <Divider />
        </Box>

        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No hay notificaciones
              </Typography>
            </Box>
          ) : (
            <List dense sx={{ py: 0 }}>
              {notifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  sx={{
                    bgcolor: notification.leida ? 'transparent' : 'action.hover',
                    borderLeft: notification.leida ? 'none' : '4px solid',
                    borderLeftColor: getPriorityColor(notification.prioridad) === 'error' ? 'error.main' : 'primary.main',
                  }}
                  secondaryAction={
                    !notification.leida && (
                      <IconButton 
                        size="small" 
                        onClick={() => markAsRead(notification.id)}
                        title="Marcar como leída"
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    )
                  }
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getNotificationIcon(notification.tipo)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
                          {notification.titulo}
                        </Typography>
                        <Chip 
                          label={notification.prioridad} 
                          size="small" 
                          color={getPriorityColor(notification.prioridad)}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box component="div">
                        <Typography variant="body2" component="div" color="text.primary" sx={{ mb: 0.5 }}>
                          {notification.mensaje}
                        </Typography>
                        <Typography variant="caption" component="div" color="text.secondary">
                          {formatDate(notification.fecha_creacion)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {notifications.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                {notifications.length} notificación(es) • {unreadCount} sin leer
              </Typography>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
};

const Usuarios = () => {
  // Estados
  const [usuarios, setUsuarios] = useState([]);
  const [estadisticas, setEstadisticas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [user, setUser] = useState(null);

  // Estados del formulario
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'lector'
  });

  const navigate = useNavigate();

  // Configuración de roles con Material-UI
  const rolesDisponibles = [
    {
      value: 'admin',
      label: 'Administrador',
      color: 'error',
      icon: <AdminIcon fontSize="small" />,
      description: 'Acceso completo al sistema'
    },
    {
      value: 'editor',
      label: 'Editor',
      color: 'warning',
      icon: <EditorIcon fontSize="small" />,
      description: 'Puede crear y editar contenido'
    },
    {
      value: 'lector',
      label: 'Lector',
      color: 'success',
      icon: <ReaderIcon fontSize="small" />,
      description: 'Solo lectura del contenido'
    }
  ];

  // Función para verificar permisos
  const tienePermiso = (accion) => {
    if (!user || !user.rol) return false;
    return PERMISOS[user.rol]?.[accion] || false;
  };

  // Función específica para verificar si es admin
  const esAdministrador = () => {
    return user && user.rol === 'admin';
  };

  // Verificar si un usuario es el usuario actual
  const esUsuarioActual = (usuario) => {
    return user && usuario.id === user.id;
  };

  // Verificar si puede restablecer contraseña de un usuario específico
  const puedeRestablecerContraseña = (usuario) => {
    // Los administradores pueden restablecer todas las contraseñas
    if (esAdministrador()) return true;
    
    // Los usuarios normales solo pueden restablecer su propia contraseña
    return esUsuarioActual(usuario);
  };

  // Obtener texto para el tooltip según los permisos
  const getTooltipRestablecimiento = (usuario) => {
    if (esAdministrador()) {
      return `Restablecer contraseña de ${usuario.nombre}`;
    }
    if (esUsuarioActual(usuario)) {
      return 'Restablecer mi contraseña';
    }
    return 'Solo puedes restablecer tu propia contraseña';
  };

  // Obtener usuario autenticado desde el backend
  // Obtener usuario autenticado desde el backend
useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) {
    navigate('/');
    return;
  }
  axios.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
   .then(res => {
  console.log('👤 Usuario cargado:', res.data);
  setUser(res.data.data); // ✅ Esto guarda solo { id: 1, nombre: '...', rol: 'admin' }
})
    .catch(() => {
      setUser(null);
      navigate('/');
    });
}, [navigate]);

  // Cargar usuarios
  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/usuarios`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setUsuarios(response.data.data);
        if (response.data.estadisticas) {
          setEstadisticas(response.data.estadisticas);
        }
        setError(null);
      } else {
        setError(response.data.message || 'Error al cargar usuarios');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const mostrarMensaje = (mensaje, tipo) => {
    if (tipo === 'success') {
      setSuccess(mensaje);
      setTimeout(() => setSuccess(null), 5000);
    } else {
      setError(mensaje);
      setTimeout(() => setError(null), 5000);
    }
  };

  // ✅ FUNCIÓN MEJORADA PARA ENVIAR RESTABLECIMIENTO DE CONTRASEÑA
  // ✅ FUNCIÓN MEJORADA PARA ENVIAR RESTABLECIMIENTO DE CONTRASEÑA CON SOPORTE OFFLINE
const enviarRestablecimientoContraseña = async (usuario) => {
  const mensajeConfirmacion = esUsuarioActual(usuario) 
    ? `¿Enviar enlace de restablecimiento de contraseña a tu email (${usuario.email})?`
    : `¿Enviar enlace de restablecimiento de contraseña a ${usuario.email}?`;
  
  if (!window.confirm(mensajeConfirmacion)) {
    return;
  }
  
  try {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    // Endpoint diferente según si es admin o usuario normal
    const endpoint = esAdministrador() 
      ? `${API_URL}/auth/admin-reset-password`
      : `${API_URL}/auth/forgot-password`;
    
    const payload = esAdministrador() 
      ? { userId: usuario.id }
      : { email: usuario.email };
    
    const response = await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.data.success) {
      const data = response.data.data;
      
      let mensajeExito = '';
      
      if (esUsuarioActual(usuario)) {
        mensajeExito = 'Solicitud de restablecimiento procesada';
      } else {
        mensajeExito = `Solicitud de restablecimiento procesada para ${usuario.email}`;
      }
      
      // Agregar información del modo
      if (data.mode === 'offline') {
        mensajeExito += ' (modo offline)';
      }
      
      mostrarMensaje(mensajeExito, 'success');
      
      // Mostrar información detallada en consola
      console.log('🔐 INFORMACIÓN DE RESTABLECIMIENTO:');
      console.log(`👤 Usuario: ${usuario.nombre} (${usuario.email})`);
      console.log(`🌐 Modo: ${data.mode}`);
      console.log(`📧 Email enviado: ${data.emailSent ? 'SÍ' : 'NO'}`);
      
      if (data.resetLink) {
        console.log(`🔗 Enlace: ${data.resetLink}`);
      }
      
      if (data.token) {
        console.log(`🔑 Token: ${data.token}`);
        console.log('📋 Puedes copiar este token y pegarlo directamente en la URL:');
        console.log(`   ${window.location.origin}/reset-password/${data.token}`);
      }
      
      console.log('⏰ El token expira en 1 hora');
      
    } else {
      mostrarMensaje(response.data.message || 'Error al procesar la solicitud', 'error');
    }
  } catch (err) {
    console.error('❌ Error en restablecimiento:', err);
    mostrarMensaje(err.response?.data?.message || 'Error de conexión', 'error');
  } finally {
    setLoading(false);
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editandoUsuario && !tienePermiso('editar')) {
      mostrarMensaje('No tienes permisos para editar usuarios', 'error');
      return;
    }
    
    if (!editandoUsuario && !tienePermiso('crear')) {
      mostrarMensaje('No tienes permisos para crear usuarios', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (editandoUsuario) {
        const response = await axios.put(
          `${API_URL}/usuarios/${editandoUsuario.id}`,
          {
            nombre: formData.nombre,
            email: formData.email,
            rol: formData.rol
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          mostrarMensaje('Usuario actualizado exitosamente', 'success');
          setEditandoUsuario(null);
        } else {
          mostrarMensaje(response.data.message || 'Error al actualizar usuario', 'error');
        }
      } else {
        const response = await axios.post(
          `${API_URL}/usuarios`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          mostrarMensaje('Usuario creado exitosamente', 'success');
        } else {
          mostrarMensaje(response.data.message || 'Error al crear usuario', 'error');
        }
      }
      await cargarUsuarios();
      cerrarFormulario();
    } catch (err) {
      mostrarMensaje(err.response?.data?.message || 'Error al guardar usuario', 'error');
    } finally {
      setLoading(false);
    }
  };

  const eliminarUsuario = async (usuario) => {
    if (!tienePermiso('eliminar')) {
      mostrarMensaje('No tienes permisos para eliminar usuarios', 'error');
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${usuario.nombre}"?`)) {
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/usuarios/${usuario.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        mostrarMensaje('Usuario eliminado exitosamente', 'success');
        await cargarUsuarios();
      } else {
        mostrarMensaje(response.data.message || 'Error al eliminar usuario', 'error');
      }
    } catch (err) {
      mostrarMensaje(err.response?.data?.message || 'Error al eliminar usuario', 'error');
    } finally {
      setLoading(false);
    }
  };

  const abrirFormularioNuevo = () => {
    if (!tienePermiso('crear')) {
      mostrarMensaje('No tienes permisos para crear usuarios', 'error');
      return;
    }
    
    setFormData({ nombre: '', email: '', password: '', rol: 'lector' });
    setEditandoUsuario(null);
    setMostrarFormulario(true);
  };

  const abrirFormularioEditar = (usuario) => {
    if (!tienePermiso('editar')) {
      mostrarMensaje('No tienes permisos para editar usuarios', 'error');
      return;
    }
    
    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      rol: usuario.rol
    });
    setEditandoUsuario(usuario);
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setEditandoUsuario(null);
    setFormData({ nombre: '', email: '', password: '', rol: 'lector' });
  };

  const obtenerInfoRol = (rol) => {
    return rolesDisponibles.find(r => r.value === rol) || rolesDisponibles[2];
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

 const getInitials = (nombre) => {
  if (!nombre) return '??';
  return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};
  const handleLogout = () => {
    // Limpiar todos los datos de autenticación
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('userPreferences');
    sessionStorage.clear();
    
    // Redirigir limpiamente al login
    window.location.href = '/';
  };

  const irAPagos = () => {
    navigate('/admin/pagos');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* AppBar superior */}
      <AppBar position="static" color="primary" elevation={2}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Gestión de Usuarios
          </Typography>
          
          {/* CAMPANITA REAL */}
          <NotificationBell />

          {user && user.nombre && user.rol && (
  <>
    <Chip
      label={`${user.nombre} (${user.rol})`}
      color={user.rol === 'admin' ? 'error' : user.rol === 'editor' ? 'warning' : 'success'}
      sx={{ mr: 2, fontWeight: 600 }}
      avatar={<Avatar>{getInitials(user.nombre)}</Avatar>}
    />
              
              <Button
                variant="outlined"
                startIcon={<LocationOn />}
                onClick={() => navigate('/locations')}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.9)',
                  color: 'primary.main',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': { 
                    bgcolor: 'white',
                    borderColor: 'primary.main',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
                  },
                  '&:active': {
                    transform: 'translateY(1px)'
                  },
                  mr: 2,
                  fontWeight: 600,
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  transition: 'all 0.3s ease'
                }}
              >
                Mi Ubicación
              </Button>

<Button
  variant="outlined"
  onClick={() => navigate('/reportes')}
  sx={{ 
    bgcolor: 'rgba(255,255,255,0.9)',
    color: 'primary.main',
    mr: 2
  }}
>
  Reportes
</Button>

<Button
  variant="outlined"
  onClick={() => navigate('/proveedores')}
  
  sx={{     bgcolor: 'rgba(255,255,255,0.9)',
mr: 2 }}
>
  Proveedores
</Button>

              {/* Botón para Tienda */}
              <Button
                variant="outlined"
                startIcon={<LocationOn />}
                onClick={() => navigate('/shop')}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.9)',
                  color: 'primary.main',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': { 
                    bgcolor: 'white',
                    borderColor: 'primary.main',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
                  },
                  '&:active': {
                    transform: 'translateY(1px)'
                  },
                  mr: 2,
                  fontWeight: 600,
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  transition: 'all 0.3s ease'
                }}
              >
                Tienda
              </Button>

              {/* Botón para Preferencias de usuario */}
              <Button
                variant="outlined"
                onClick={() => navigate('/preferentuser')}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.9)',
                  color: 'primary.main',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': { 
                    bgcolor: 'white',
                    borderColor: 'primary.main',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
                  },
                  '&:active': {
                    transform: 'translateY(1px)'
                  },
                  mr: 2,
                  fontWeight: 600,
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  transition: 'all 0.3s ease'
                }}
              >
                Preferencias de usuario
              </Button>

              {/* Botón para Administrar Pagos (solo admin) */}
              {esAdministrador() && (
                <Button
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={irAPagos}
                  sx={{ 
                    bgcolor: 'secondary.main',
                    color: 'white',
                    borderColor: 'secondary.main',
                    '&:hover': { 
                      bgcolor: 'secondary.dark',
                      borderColor: 'secondary.dark',
                      boxShadow: '0 4px 12px rgba(156, 39, 176, 0.4)'
                    },
                    '&:active': {
                      transform: 'translateY(1px)'
                    },
                    mr: 2,
                    fontWeight: 600,
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  Administrar Pagos
                </Button>
              )}
              
              <Button
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{ fontWeight: 600 }}
              >
                Cerrar Sesión
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading && usuarios.length === 0}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'white',
          borderBottom: 1,
          borderColor: 'divider',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'white', color: 'primary.main', width: 56, height: 56 }}>
                <PersonIcon fontSize="large" />
              </Avatar>
              <Box>
                <Typography variant="h3" component="h1" sx={{ color: 'white', fontWeight: 700 }}>
                  Gestión de Usuarios
                </Typography>
                <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Administra usuarios y roles del sistema
                </Typography>
              </Box>
            </Box>

            {tienePermiso('crear') ? (
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={abrirFormularioNuevo}
                disabled={loading}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'grey.100' },
                  borderRadius: 3,
                  px: 3,
                  py: 1.5
                }}
              >
                Nuevo Usuario
              </Button>
            ) : (
              <Tooltip title="No tienes permisos para crear usuarios">
                <Box>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<LockIcon />}
                    disabled
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.3)',
                      color: 'white',
                      borderRadius: 3,
                      px: 3,
                      py: 1.5
                    }}
                  >
                    Sin permisos
                  </Button>
                </Box>
              </Tooltip>
            )}
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Mensajes */}
        <Collapse in={!!error}>
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, borderRadius: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        </Collapse>

        <Collapse in={!!success}>
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 3, borderRadius: 2 }}>
            <AlertTitle>Éxito</AlertTitle>
            {success}
          </Alert>
        </Collapse>

        {/* Panel de permisos */}
        {user && (
          <Card elevation={0} sx={{ mb: 3, borderRadius: 3, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tus permisos actuales ({obtenerInfoRol(user.rol).label})
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Chip
                  icon={<ReaderIcon />}
                  label="Ver"
                  color={tienePermiso('ver') ? 'success' : 'default'}
                  variant={tienePermiso('ver') ? 'filled' : 'outlined'}
                />
                <Chip
                  icon={<AddIcon />}
                  label="Crear"
                  color={tienePermiso('crear') ? 'success' : 'default'}
                  variant={tienePermiso('crear') ? 'filled' : 'outlined'}
                />
                <Chip
                  icon={<EditIcon />}
                  label="Editar"
                  color={tienePermiso('editar') ? 'success' : 'default'}
                  variant={tienePermiso('editar') ? 'filled' : 'outlined'}
                />
                <Chip
                  icon={<DeleteIcon />}
                  label="Eliminar"
                  color={tienePermiso('eliminar') ? 'success' : 'default'}
                  variant={tienePermiso('eliminar') ? 'filled' : 'outlined'}
                />
                <Chip
                  icon={<KeyIcon />}
                  label="Restablecer Contraseña"
                  color="warning"
                  variant="filled"
                />
                {esAdministrador() && (
                  <Chip
                    icon={<PaymentIcon />}
                    label="Administrar Pagos"
                    color="secondary"
                    variant="filled"
                  />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {esAdministrador() 
                  ? 'Puedes restablecer contraseñas de todos los usuarios' 
                  : 'Puedes restablecer tu propia contraseña'}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Estadísticas con tarjetas mejoradas */}
        {estadisticas.length > 0 && (
          <Fade in={estadisticas.length > 0}>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {estadisticas.map((stat) => {
                const rolInfo = obtenerInfoRol(stat.rol);
                return (
                  <Grid item xs={12} sm={6} md={4} key={stat.rol}>
                    <Card
                      elevation={0}
                      sx={{
                        position: 'relative',
                        overflow: 'visible',
                        borderRadius: 3,
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                              {rolInfo.label}s
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 700, color: 'text.primary' }}>
                              {stat.cantidad}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {rolInfo.description}
                            </Typography>
                          </Box>
                          <Avatar
                            sx={{
                              bgcolor: alpha(
                                rolInfo.color === 'error' ? '#f44336' :
                                  rolInfo.color === 'warning' ? '#ff9800' : '#4caf50',
                                0.1
                              ),
                              color: rolInfo.color === 'error' ? '#f44336' :
                                rolInfo.color === 'warning' ? '#ff9800' : '#4caf50',
                              width: 56,
                              height: 56
                            }}
                          >
                            {rolInfo.icon}
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Fade>
        )}

        {/* Tabla de usuarios - CORREGIDA LA ESTRUCTURA */}
        <Card elevation={0} sx={{ borderRadius: 3, border: 1, borderColor: 'divider' }}>
          <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Lista de Usuarios
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {usuarios.length} usuarios registrados
              </Typography>
            </Box>
          </Box>
          <Divider />

          {loading && usuarios.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : usuarios.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <PersonIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No hay usuarios registrados
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {tienePermiso('crear') ? 'Comienza creando un nuevo usuario' : 'No tienes permisos para crear usuarios'}
              </Typography>
              {tienePermiso('crear') && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={abrirFormularioNuevo}
                >
                  Crear Primer Usuario
                </Button>
              )}
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Usuario</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Rol</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Fecha de Creación</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usuarios.map((usuario) => {
                    const rolInfo = obtenerInfoRol(usuario.rol);
                    const esMiUsuario = esUsuarioActual(usuario);
                    const puedeRestablecer = puedeRestablecerContraseña(usuario);
                    
                    return (
                      <TableRow
                        key={usuario.id}
                        sx={{
                          '&:hover': { bgcolor: 'grey.50' },
                          '&:last-child td': { border: 0 },
                          bgcolor: esMiUsuario ? 'action.hover' : 'transparent'
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ 
                              bgcolor: esMiUsuario ? 'primary.main' : 'grey.400',
                              width: 40, 
                              height: 40 
                            }}>
                              {getInitials(usuario.nombre)}
                              {esMiUsuario && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    bottom: -2,
                                    right: -2,
                                    width: 12,
                                    height: 12,
                                    bgcolor: 'success.main',
                                    borderRadius: '50%',
                                    border: '2px solid white'
                                  }}
                                />
                              )}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {usuario.nombre} {esMiUsuario && '(Tú)'}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <EmailIcon fontSize="small" sx={{ color: 'grey.500' }} />
                                <Typography variant="body2" color="text.secondary">
                                  {usuario.email}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={rolInfo.icon}
                            label={rolInfo.label}
                            color={rolInfo.color}
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarIcon fontSize="small" sx={{ color: 'grey.500' }} />
                            <Typography variant="body2" color="text.secondary">
                              {formatearFecha(usuario.fecha_creacion)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            {tienePermiso('editar') ? (
                              <Tooltip title="Editar usuario">
                                <IconButton
                                  size="small"
                                  onClick={() => abrirFormularioEditar(usuario)}
                                  sx={{ color: 'primary.main' }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Sin permisos para editar">
                                <span>
                                  <IconButton size="small" disabled>
                                    <LockIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                            
                            {/* ✅ BOTÓN DE RESTABLECIMIENTO DE CONTRASEÑA (para todos los usuarios según permisos) */}
                            <Tooltip title={getTooltipRestablecimiento(usuario)}>
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => enviarRestablecimientoContraseña(usuario)}
                                  disabled={!puedeRestablecer}
                                  sx={{ 
                                    color: puedeRestablecer 
                                      ? (esMiUsuario ? 'info.main' : 'warning.main') 
                                      : 'disabled' 
                                  }}
                                >
                                  <KeyIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            
                            {tienePermiso('eliminar') && !esMiUsuario ? (
                              <Tooltip title="Eliminar usuario">
                                <IconButton
                                  size="small"
                                  onClick={() => eliminarUsuario(usuario)}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title={esMiUsuario ? "No puedes eliminarte a ti mismo" : "Sin permisos para eliminar"}>
                                <span>
                                  <IconButton size="small" disabled>
                                    <LockIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </Container>

      {/* Formulario Modal */}
      <Dialog
        open={mostrarFormulario}
        onClose={cerrarFormulario}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {editandoUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {editandoUsuario ? 'Modifica los datos del usuario' : 'Completa la información del nuevo usuario'}
          </Typography>
        </DialogTitle>

        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Nombre completo"
                variant="outlined"
                required
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ingresa el nombre completo"
              />

              <TextField
                fullWidth
                label="Email"
                type="email"
                variant="outlined"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="usuario@ejemplo.com"
              />

              {!editandoUsuario && (
                <TextField
                  fullWidth
                  label="Contraseña"
                  type="password"
                  variant="outlined"
                  required={!editandoUsuario}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  inputProps={{ minLength: 6 }}
                />
              )}

              <TextField
                fullWidth
                select
                label="Rol"
                variant="outlined"
                value={formData.rol}
                onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
              >
                {rolesDisponibles.map((rol) => (
                  <MenuItem key={rol.value} value={rol.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {rol.icon}
                      <Box>
                        <Typography variant="body2">{rol.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rol.description}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button
              onClick={cerrarFormulario}
              startIcon={<CloseIcon />}
              sx={{ mr: 1 }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
              disabled={loading}
              sx={{ borderRadius: 2 }}
            >
              {editandoUsuario ? 'Actualizar' : 'Crear Usuario'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* FAB para agregar usuario en móviles - solo si tiene permisos */}
      {tienePermiso('crear') && (
        <Fab
          color="primary"
          aria-label="add user"
          onClick={abrirFormularioNuevo}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { xs: 'flex', sm: 'none' }
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default Usuarios;