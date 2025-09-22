import React, { useState, useEffect } from 'react';
import {
  Badge,
  IconButton,
  Menu,
  Box,
  Typography,
  Divider,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Check as CheckIcon,
  Security as SecurityIcon,
  SystemUpdate as SystemUpdateIcon,
  AdminPanelSettings as AdminIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const open = Boolean(anchorEl);

  // Cargar notificaciones REALES del backend
  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      console.log('🔄 Cargando notificaciones REALES del backend...');
      
      const response = await axios.get(`${API_URL}/notifications`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Respuesta del backend:', response.data);
      
      if (response.data.success) {
        const notifs = response.data.notifications || [];
        console.log('📨 Notificaciones REALES recibidas:', notifs.length, notifs);
        
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.leida).length);
      } else {
        setError('Error al cargar notificaciones');
      }
    } catch (error) {
      console.error('❌ Error cargando notificaciones:', error);
      setError('No se pudieron cargar las notificaciones: ' + error.message);
    } finally {
      setLoading(false);
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

  // SOLO cargar al montar - NO hay simulaciones
  useEffect(() => {
    console.log('✅ NotificationBell NUEVO montado - Listo para datos REALES');
  }, []);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ position: 'relative' }}
      >
        <Badge 
          badgeContent={unreadCount} 
          color="error"
          max={99}
        >
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { 
            width: 400, 
            maxWidth: '90vw', 
            maxHeight: '70vh',
            mt: 1
          }
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              Notificaciones REALES
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
          
          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          
          <Divider />
        </Box>

        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Cargando notificaciones REALES...
              </Typography>
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No hay notificaciones REALES
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Las notificaciones de la BD aparecerán aquí
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
                          {notification.leida && (
                            <Typography variant="caption" component="span" color="success.main" sx={{ ml: 1 }}>
                              • Leída
                            </Typography>
                          )}
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
                {notifications.length} notificación(es) REALES de la BD
                {unreadCount > 0 && ` • ${unreadCount} sin leer`}
              </Typography>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
};

export default NotificationBell;