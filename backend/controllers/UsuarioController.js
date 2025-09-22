const Usuario = require('../models/Usuario');
const notificationMiddleware = require('../middlewares/notificationMiddleware'); // ← NUEVO

class UsuarioController {
  
  // GET /api/usuarios - Obtener todos los usuarios
  static async obtenerUsuarios(req, res) {
    try {
      const usuarios = await Usuario.obtenerTodos();
      const estadisticas = await Usuario.obtenerEstadisticasPorRol();
      
      res.json({
        success: true,
        data: usuarios,
        estadisticas: estadisticas,
        total: usuarios.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener la lista de usuarios',
        error: error.message
      });
    }
  }

  // POST /api/usuarios/ubicacion - Actualizar ubicación
  static async actualizarUbicacion(req, res) {
    try {
      const userId = req.user.userId;
      const { latitude, longitude, accuracy, timestamp } = req.body;
      
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || typeof accuracy !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Datos de ubicación inválidos'
        });
      }

      // Actualizar ubicación en la base de datos
      await Usuario.actualizarUbicacion(userId, {
        latitude,
        longitude,
        accuracy,
        timestamp
      });

      // Notificar al usuario sobre la actualización de ubicación ← NUEVO
      await notificationMiddleware.onUserDataModified(
        req.user.userId,
        userId,
        { tipo: 'ubicacion', mensaje: 'Ubicación actualizada correctamente' }
      );

      res.json({
        success: true,
        message: 'Ubicación actualizada exitosamente'
      });

    } catch (error) {
      console.error('Error al actualizar ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar ubicación',
        error: error.message
      });
    }
  }

  // GET /api/usuarios/:id - Obtener usuario por ID
  static async obtenerUsuarioPorId(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }
      
      const usuario = await Usuario.obtenerPorId(parseInt(id));
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: usuario
      });
      
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuario',
        error: error.message
      });
    }
  }

  // POST /api/usuarios - Crear nuevo usuario
  static async crearUsuario(req, res) {
    try {
      const { nombre, email, password, rol } = req.body;
      
      if (!nombre || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, email y password son requeridos',
          data: { nombre, email, rol }
        });
      }
      
      const usuario = new Usuario(null, nombre.trim(), email.trim(), password, rol || '');
      await usuario.guardar();
      
      const usuarioRespuesta = {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        fecha_creacion: usuario.fecha_creacion
      };

      // Notificar al administrador sobre nuevo usuario ← NUEVO
      if (req.user && req.user.rol === 'admin') {
        await notificationMiddleware.onUserDataModified(
          req.user.userId,
          usuario.id,
          { tipo: 'nuevo_usuario', mensaje: `Nuevo usuario creado: ${usuario.nombre}` }
        );
      }
      
      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: usuarioRespuesta
      });
      
    } catch (error) {
      console.error('Error al crear usuario:', error);
      res.status(400).json({
        success: false,
        message: error.message,
        data: {
          nombre: req.body.nombre,
          email: req.body.email,
          rol: req.body.rol
        }
      });
    }
  }

  // PUT /api/usuarios/:id - Actualizar usuario
  static async actualizarUsuario(req, res) {
    try {
      const { id } = req.params;
      const { nombre, email, rol } = req.body;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }
      
      if (!nombre || !email) {
        return res.status(400).json({
          success: false,
          message: 'Nombre y email son requeridos'
        });
      }
      
      const usuario = await Usuario.obtenerPorId(parseInt(id));
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Guardar datos antiguos para la notificación ← NUEVO
      const datosAntiguos = {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      };
      
      usuario.nombre = nombre.trim();
      usuario.email = email.trim();
      usuario.rol = rol || usuario.rol;
      
      await usuario.actualizar();

      // Notificar al usuario sobre los cambios ← NUEVO
      await notificationMiddleware.onUserDataModified(
        req.user.userId,
        usuario.id,
        { 
          tipo: 'actualizacion_perfil',
          cambios: {
            nombre: { de: datosAntiguos.nombre, a: usuario.nombre },
            email: { de: datosAntiguos.email, a: usuario.email },
            rol: { de: datosAntiguos.rol, a: usuario.rol }
          },
          administrador: req.user.nombre || 'Sistema'
        }
      );
      
      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          fecha_creacion: usuario.fecha_creacion
        }
      });
      
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // DELETE /api/usuarios/:id - Eliminar usuario
  static async eliminarUsuario(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }
      
      const usuario = await Usuario.obtenerPorId(parseInt(id));
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Guardar información para la notificación ← NUEVO
      const usuarioEliminado = {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      };
      
      await usuario.eliminar();

      // Notificar a administradores sobre eliminación ← NUEVO
      await notificationMiddleware.onUserDataModified(
        req.user.userId,
        usuario.id,
        { 
          tipo: 'usuario_eliminado',
          usuario: usuarioEliminado,
          eliminado_por: req.user.nombre || 'Sistema'
        }
      );
      
      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente',
        data: { id: parseInt(id) }
      });
      
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar usuario',
        error: error.message
      });
    }
  }

  // GET /api/usuarios/roles - Obtener roles válidos
  static obtenerRoles(req, res) {
    res.json({
      success: true,
      data: Usuario.ROLES_VALIDOS,
      descriptions: {
        admin: 'Acceso completo al sistema',
        editor: 'Puede crear y editar contenido',
        lector: 'Solo puede leer contenido'
      }
    });
  }

  // GET /api/usuarios/estadisticas - Obtener estadísticas
  static async obtenerEstadisticas(req, res) {
    try {
      const estadisticas = await Usuario.obtenerEstadisticasPorRol();
      const usuarios = await Usuario.obtenerTodos();
      
      res.json({
        success: true,
        data: {
          por_rol: estadisticas,
          total_usuarios: usuarios.length,
          ultimo_usuario: usuarios.length > 0 ? usuarios[0] : null
        }
      });
      
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  }

  // GET /api/health - Health check del API
  static healthCheck(req, res) {
    res.json({
      success: true,
      message: 'API funcionando correctamente',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  }
}

module.exports = UsuarioController;