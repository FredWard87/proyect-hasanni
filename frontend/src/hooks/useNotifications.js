import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, token } = useAuth();

  const loadNotifications = useCallback(async (page = 1, limit = 20) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/notifications?page=${page}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotifications(data.notifications);
          setUnreadCount(data.notifications.filter(n => !n.leida).length);
        }
        return data;
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  }, [token]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId ? { ...notif, leida: true } : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        return true;
      }
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
    return false;
  }, [token]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/notifications/mark-all-read`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, leida: true }))
        );
        setUnreadCount(0);
        return true;
      }
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    }
    return false;
  }, [token]);

  // Cargar notificaciones al iniciar
  useEffect(() => {
    if (token && user) {
      loadNotifications();
    }
  }, [token, user, loadNotifications]);

  return {
    notifications,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead
  };
};